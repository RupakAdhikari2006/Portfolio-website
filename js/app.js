/**
 * app.js - Main client-side script for loading and rendering data
 */

// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('open');
      navLinks.classList.toggle('open');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  // Header scroll class
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // Initialize data loading based on current page
  initPageData();
});

/**
 * Loads data from LocalStorage (if updated via Admin panel) or fetches static JSON files
 */
async function loadData(type) {
  const localData = localStorage.getItem(`portfolio_${type}`);
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch (e) {
      console.error(`Error parsing LocalStorage portfolio_${type}`, e);
    }
  }

  // Fallback to fetch static JSON files
  try {
    const response = await fetch(`./data/${type}.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    // Cache in LocalStorage for smooth performance / edits
    localStorage.setItem(`portfolio_${type}`, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error(`Failed to load ${type} data:`, error);
    return [];
  }
}

/**
 * Route page logic based on current file/path
 */
async function initPageData() {
  // Clear old template cache to load Rupak's actual data
  const localProj = localStorage.getItem('portfolio_projects');
  if (localProj && (localProj.includes('Elena Vance') || localProj.includes('Aura - Minimal'))) {
    localStorage.removeItem('portfolio_projects');
    localStorage.removeItem('portfolio_posts');
  }

  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '') {
    await renderHomePage();
  } else if (page === 'projects.html') {
    await renderProjectsPage();
  } else if (page === 'blog.html') {
    await renderBlogPage();
  } else if (page === 'post.html') {
    await renderPostDetailPage();
  }
}

/**
 * Home Page Rendering (Featured Projects & Blogs)
 */
async function renderHomePage() {
  const projects = await loadData('projects');
  const posts = await loadData('posts');

  // Render featured projects (limit to 3)
  const featuredProjects = projects.filter(p => p.featured).slice(0, 3);
  const projectsGrid = document.querySelector('.projects-grid');
  if (projectsGrid) {
    if (featuredProjects.length === 0) {
      projectsGrid.innerHTML = '<p class="text-secondary">No featured projects found.</p>';
    } else {
      projectsGrid.innerHTML = featuredProjects.map(project => createProjectCardHTML(project)).join('');
    }
  }

  // Render featured blog posts (limit to 3)
  const featuredPosts = posts.filter(p => p.featured).slice(0, 3);
  const blogGrid = document.querySelector('.blog-grid');
  if (blogGrid) {
    if (featuredPosts.length === 0) {
      blogGrid.innerHTML = '<p class="text-secondary">No featured blog posts found.</p>';
    } else {
      blogGrid.innerHTML = featuredPosts.map(post => createBlogCardHTML(post)).join('');
    }
  }
}

/**
 * Projects Gallery Page Rendering (Filters + Search)
 */
async function renderProjectsPage() {
  const projects = await loadData('projects');
  const projectsGrid = document.querySelector('.projects-grid');
  const searchInput = document.getElementById('project-search');
  const filterButtons = document.querySelectorAll('.filter-btn');

  if (!projectsGrid) return;

  let activeFilter = 'all';
  let searchQuery = '';

  const filterAndRender = () => {
    let filtered = projects;

    // Filter by tag/category
    if (activeFilter !== 'all') {
      filtered = filtered.filter(p => 
        p.tags.some(tag => tag.toLowerCase() === activeFilter.toLowerCase())
      );
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      projectsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem 0; color: var(--text-secondary);">No projects matched your filters.</div>';
    } else {
      projectsGrid.innerHTML = filtered.map(project => createProjectCardHTML(project)).join('');
    }
  };

  // Setup Search Event
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      filterAndRender();
    });
  }

  // Setup Filter Buttons Click Events
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.dataset.filter;
      filterAndRender();
    });
  });

  // Initial render
  filterAndRender();
}

/**
 * Blog Listing Page Rendering
 */
async function renderBlogPage() {
  const posts = await loadData('posts');
  const blogGrid = document.querySelector('.blog-grid');
  const searchInput = document.getElementById('blog-search');

  if (!blogGrid) return;

  let searchQuery = '';

  const filterAndRender = () => {
    let filtered = posts;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      blogGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem 0; color: var(--text-secondary);">No blog articles found.</div>';
    } else {
      blogGrid.innerHTML = filtered.map(post => createBlogCardHTML(post)).join('');
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      filterAndRender();
    });
  }

  // Initial render
  filterAndRender();
}

/**
 * Single Blog Detail Page Rendering (with markdown parser)
 */
async function renderPostDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (!postId) {
    window.location.href = 'blog.html';
    return;
  }

  const posts = await loadData('posts');
  const post = posts.find(p => p.id === postId);

  if (!post) {
    document.querySelector('.post-body-container').innerHTML = `
      <div style="text-align: center; padding: 5rem 0;">
        <h2 class="section-title">Post Not Found</h2>
        <p class="text-secondary">We couldn't find the article you are looking for.</p>
        <br><br>
        <a href="blog.html" class="btn btn-secondary">Back to Blog</a>
      </div>
    `;
    return;
  }

  // Update DOM elements
  document.title = `${post.title} | Portfolio`;
  
  const postTitleEl = document.querySelector('.post-title');
  if (postTitleEl) postTitleEl.textContent = post.title;

  const postDateEl = document.getElementById('post-date');
  if (postDateEl) postDateEl.textContent = formatDate(post.date);

  const postAuthorEl = document.getElementById('post-author');
  if (postAuthorEl) postAuthorEl.textContent = post.author || 'Rupak Adhikari';

  const postHeroImgEl = document.querySelector('.post-hero-image');
  if (postHeroImgEl) {
    postHeroImgEl.src = post.image || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80';
    postHeroImgEl.alt = post.title;
  }

  const postContentEl = document.querySelector('.post-content');
  if (postContentEl) {
    postContentEl.innerHTML = parseMarkdown(post.content);
  }
}

/**
 * Helpers to create HTML card markups
 */
function createProjectCardHTML(project) {
  const tagsHTML = project.tags.map(t => `<span class="project-tag">${t}</span>`).join('');
  return `
    <div class="project-card">
      <div class="project-image-wrapper">
        <img src="${project.image || 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80'}" alt="${project.title}" loading="lazy">
      </div>
      <div class="project-content">
        <div class="project-tags">${tagsHTML}</div>
        <h3 class="project-card-title">${project.title}</h3>
        <p class="project-card-description">${project.description}</p>
        <div class="project-link-wrapper">
          <a href="${project.link}" target="_blank" rel="noopener noreferrer" class="btn-text">View Project</a>
        </div>
      </div>
    </div>
  `;
}

function createBlogCardHTML(post) {
  return `
    <div class="blog-card">
      <div class="blog-image-wrapper">
        <img src="${post.image || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80'}" alt="${post.title}" loading="lazy">
      </div>
      <div class="blog-content">
        <div class="blog-meta">
          <span>${formatDate(post.date)}</span>
          <span>•</span>
          <span>By ${post.author || 'Rupak'}</span>
        </div>
        <h3 class="blog-card-title">
          <a href="post.html?id=${post.id}">${post.title}</a>
        </h3>
        <p class="blog-card-excerpt">${post.excerpt}</p>
        <div style="margin-top: auto;">
          <a href="post.html?id=${post.id}" class="btn-text">Read Article</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format Date (e.g. "2026-07-02" to "July 2, 2026")
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

/**
 * Highly robust, light, dependency-free Markdown to HTML parser
 */
function parseMarkdown(markdown) {
  if (!markdown) return '';
  
  let html = markdown;

  // Escape HTML entities to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore linebreaks inside blockquotes/pre code blocks later, standard code block placeholder
  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    codeBlocks.push(code.trim());
    return `___CODE_BLOCK_PLACEHOLDER_${codeBlocks.length - 1}___`;
  });

  // Inline Code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (h1, h2, h3)
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');

  // Blockquotes (e.g., > Quote)
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Lists (Unordered - and Ordered)
  // Simple lists mapping
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\s*\*\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<ol-li>$1</ol-li>');
  html = html.replace(/(<ol-li>.*<\/ol-li>)/gs, '<ol>$1</ol>');
  html = html.replace(/<ol-li>/g, '<li>').replace(/<\/ol-li>/g, '</li>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italics (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Split into paragraphs (non-header, non-list, non-blockquote lines)
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    line = line.trim();
    if (!line) return '';
    
    // If it's already an HTML block element, leave it
    if (line.startsWith('<h') || 
        line.startsWith('<ul') || 
        line.startsWith('<ol') || 
        line.startsWith('<li') || 
        line.startsWith('</ul') || 
        line.startsWith('</ol') || 
        line.startsWith('</li') || 
        line.startsWith('<blockquote') || 
        line.startsWith('</blockquote>') ||
        line.startsWith('___CODE_BLOCK_PLACEHOLDER')) {
      return line;
    }
    
    return `<p>${line}</p>`;
  });
  
  html = processedLines.filter(l => l !== '').join('\n');

  // Clean up nested lists/paragraphs bugs from regex splitting
  html = html.replace(/<\/ul>\n<ul>/g, '');
  html = html.replace(/<\/ol>\n<ol>/g, '');

  // Restore Code Blocks
  html = html.replace(/___CODE_BLOCK_PLACEHOLDER_(\d+)___/g, (match, index) => {
    const code = codeBlocks[index];
    return `<pre><code>${code}</code></pre>`;
  });

  return html;
}
