/**
 * admin.js - Admin dashboard script for managing projects, posts, and syncing with GitHub
 */

// Global state loaded from LocalStorage
let projects = [];
let posts = [];
let editingProjectId = null;
let editingPostId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check authorization
  checkAuth();

  // Tab switching setup
  setupTabs();

  // Load and render lists
  loadAdminData();

  // Project form submit
  const projectForm = document.getElementById('project-form');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectSubmit);
  }

  // Cancel project edit
  const cancelProjBtn = document.getElementById('cancel-project-edit');
  if (cancelProjBtn) {
    cancelProjBtn.addEventListener('click', resetProjectForm);
  }

  // Post form submit
  const postForm = document.getElementById('post-form');
  if (postForm) {
    postForm.addEventListener('submit', handlePostSubmit);
  }

  // Cancel post edit
  const cancelPostBtn = document.getElementById('cancel-post-edit');
  if (cancelPostBtn) {
    cancelPostBtn.addEventListener('click', resetPostForm);
  }

  // Markdown live preview setup
  const postContentInput = document.getElementById('post-content');
  const postPreviewEl = document.getElementById('post-markdown-preview');
  if (postContentInput && postPreviewEl) {
    postContentInput.addEventListener('input', (e) => {
      // Use parseMarkdown function from app.js (available globally)
      if (typeof parseMarkdown === 'function') {
        postPreviewEl.innerHTML = parseMarkdown(e.target.value);
      } else {
        postPreviewEl.textContent = e.target.value;
      }
    });
  }

  // Image upload handlers
  setupImageUpload();

  // Sync settings and operations setup
  setupSyncAndGitHub();
});

/**
 * Basic passcode-based client auth
 */
function checkAuth() {
  const authOverlay = document.getElementById('auth-overlay');
  const authForm = document.getElementById('auth-form');
  const authPassInput = document.getElementById('auth-password');
  
  const isAuthed = localStorage.getItem('portfolio_auth_token') === 'true';

  if (isAuthed) {
    if (authOverlay) authOverlay.style.display = 'none';
    return;
  }

  if (authOverlay && authForm) {
    authOverlay.style.display = 'flex';
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // Default passphrase is "rupak@123"
      if (authPassInput.value === 'rupak@123') {
        localStorage.setItem('portfolio_auth_token', 'true');
        authOverlay.style.display = 'none';
        showToast('Successfully logged in.');
      } else {
        alert('Invalid password. Hint: check the admin login screen.');
        authPassInput.value = '';
      }
    });
  }
}

function logout() {
  localStorage.removeItem('portfolio_auth_token');
  location.reload();
}

/**
 * Handle tabs switching
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.admin-tab-btn');
  const sections = document.querySelectorAll('.admin-content-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      sections.forEach(sec => {
        if (sec.id === `${target}-section`) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });
    });
  });
}

/**
 * Load projects and posts from storage and render them on dashboard and edit lists
 */
async function loadAdminData() {
  // Always load fresh from JSON files (clearing any old cached data)
  localStorage.removeItem('portfolio_projects');
  localStorage.removeItem('portfolio_posts');

  projects = await fetchJSON('projects');
  posts = await fetchJSON('posts');

  renderAdminProjects();
  renderAdminPosts();
  updateDashboardStats();
}

async function fetchJSON(type) {
  try {
    const response = await fetch(`./data/${type}.json`);
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem(`portfolio_${type}`, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.error(`Failed to fetch default ${type} json:`, err);
  }
  return [];
}

function updateDashboardStats() {
  const totalProjectsEl = document.getElementById('stat-total-projects');
  const totalPostsEl = document.getElementById('stat-total-posts');
  const lastUpdatedEl = document.getElementById('stat-last-updated');

  if (totalProjectsEl) totalProjectsEl.textContent = projects.length;
  if (totalPostsEl) totalPostsEl.textContent = posts.length;
  if (lastUpdatedEl) {
    const now = new Date();
    lastUpdatedEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString();
  }
}

/**
 * Projects CRUD & Rendering
 */
function renderAdminProjects() {
  const container = document.getElementById('admin-projects-list');
  if (!container) return;

  if (projects.length === 0) {
    container.innerHTML = '<p class="text-muted">No projects found. Add one on the right.</p>';
    return;
  }

  container.innerHTML = projects.map(proj => `
    <div class="admin-item-card">
      <div class="admin-item-info">
        <h4>${proj.title}</h4>
        <span>${proj.date} • ${proj.tags.join(', ')}</span>
      </div>
      <div class="admin-item-actions">
        <button class="btn-icon" onclick="editProject('${proj.id}')" title="Edit">✎</button>
        <button class="btn-icon btn-icon-danger" onclick="deleteProject('${proj.id}')" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function handleProjectSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('proj-title').value;
  const description = document.getElementById('proj-desc').value;
  // Prefer base64 uploaded image over URL field
  const uploadedImage = document.getElementById('proj-image-preview-img')?.src;
  const urlImage = document.getElementById('proj-image').value;
  const image = (uploadedImage && uploadedImage.startsWith('data:')) ? uploadedImage : (urlImage || '');
  const tagsInput = document.getElementById('proj-tags').value;
  const link = document.getElementById('proj-link').value;
  const featured = document.getElementById('proj-featured').checked;
  const date = document.getElementById('proj-date').value || new Date().toISOString().split('T')[0];

  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

  if (editingProjectId) {
    // Edit existing project
    projects = projects.map(p => {
      if (p.id === editingProjectId) {
        return { ...p, title, description, image, tags, link, featured, date };
      }
      return p;
    });
    showToast('Project updated successfully.');
  } else {
    // Add new project
    const newProj = {
      id: 'project-' + Date.now(),
      title,
      description,
      image,
      tags,
      link,
      featured,
      date
    };
    projects.push(newProj);
    showToast('Project added successfully.');
  }

  saveProjectsToStorage();
  resetProjectForm();
  renderAdminProjects();
  updateDashboardStats();
}

function editProject(id) {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;

  editingProjectId = id;
  document.getElementById('admin-project-form-title').textContent = 'Edit Project';
  document.getElementById('proj-title').value = proj.title;
  document.getElementById('proj-desc').value = proj.description;
  document.getElementById('proj-tags').value = proj.tags.join(', ');
  document.getElementById('proj-link').value = proj.link;
  document.getElementById('proj-featured').checked = proj.featured;
  document.getElementById('proj-date').value = proj.date;

  // Show image in preview if available
  const previewBox = document.getElementById('proj-image-preview');
  const previewImg = document.getElementById('proj-image-preview-img');
  const urlInput = document.getElementById('proj-image');
  if (proj.image && proj.image.startsWith('data:')) {
    previewImg.src = proj.image;
    previewBox.style.display = 'block';
    urlInput.value = '';
  } else {
    urlInput.value = proj.image || '';
    previewBox.style.display = 'none';
  }
  
  document.getElementById('cancel-project-edit').style.display = 'inline-flex';
}

function deleteProject(id) {
  if (confirm('Are you sure you want to delete this project?')) {
    projects = projects.filter(p => p.id !== id);
    saveProjectsToStorage();
    renderAdminProjects();
    updateDashboardStats();
    showToast('Project deleted successfully.');
    if (editingProjectId === id) resetProjectForm();
  }
}

function resetProjectForm() {
  editingProjectId = null;
  document.getElementById('admin-project-form-title').textContent = 'Add New Project';
  document.getElementById('project-form').reset();
  document.getElementById('proj-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('cancel-project-edit').style.display = 'none';
  // Clear image preview
  const previewBox = document.getElementById('proj-image-preview');
  const previewImg = document.getElementById('proj-image-preview-img');
  if (previewBox) previewBox.style.display = 'none';
  if (previewImg) previewImg.src = '';
}

function saveProjectsToStorage() {
  localStorage.setItem('portfolio_projects', JSON.stringify(projects));
}

/**
 * Blog CRUD & Rendering
 */
function renderAdminPosts() {
  const container = document.getElementById('admin-posts-list');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = '<p class="text-muted">No blog posts found. Add one on the right.</p>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="admin-item-card">
      <div class="admin-item-info">
        <h4>${post.title}</h4>
        <span>${post.date} • By ${post.author || 'Rupak'}</span>
      </div>
      <div class="admin-item-actions">
        <button class="btn-icon" onclick="editPost('${post.id}')" title="Edit">✎</button>
        <button class="btn-icon btn-icon-danger" onclick="deletePost('${post.id}')" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function handlePostSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('post-title-input').value;
  const excerpt = document.getElementById('post-excerpt').value;
  const content = document.getElementById('post-content').value;
  // Prefer base64 uploaded image over URL field
  const uploadedImage = document.getElementById('post-image-preview-img')?.src;
  const urlImage = document.getElementById('post-image-input').value;
  const image = (uploadedImage && uploadedImage.startsWith('data:')) ? uploadedImage : (urlImage || '');
  const tagsInput = document.getElementById('post-tags-input').value;
  const author = document.getElementById('post-author-input').value || 'Rupak Adhikari';
  const featured = document.getElementById('post-featured-input').checked;
  const date = document.getElementById('post-date-input').value || new Date().toISOString().split('T')[0];

  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

  if (editingPostId) {
    // Edit existing post
    posts = posts.map(p => {
      if (p.id === editingPostId) {
        return { ...p, title, excerpt, content, image, tags, author, featured, date };
      }
      return p;
    });
    showToast('Blog post updated successfully.');
  } else {
    // Add new post
    const newPost = {
      id: 'post-' + Date.now(),
      title,
      excerpt,
      content,
      image,
      tags,
      author,
      featured,
      date
    };
    posts.push(newPost);
    showToast('Blog post added successfully.');
  }

  savePostsToStorage();
  resetPostForm();
  renderAdminPosts();
  updateDashboardStats();
}

function editPost(id) {
  const post = posts.find(p => p.id === id);
  if (!post) return;

  editingPostId = id;
  document.getElementById('admin-post-form-title').textContent = 'Edit Blog Post';
  document.getElementById('post-title-input').value = post.title;
  document.getElementById('post-excerpt').value = post.excerpt;
  document.getElementById('post-content').value = post.content;
  document.getElementById('post-tags-input').value = post.tags.join(', ');
  document.getElementById('post-author-input').value = post.author || 'Rupak Adhikari';
  document.getElementById('post-featured-input').checked = post.featured;
  document.getElementById('post-date-input').value = post.date;

  // Show image in preview if available
  const previewBox = document.getElementById('post-image-preview');
  const previewImg = document.getElementById('post-image-preview-img');
  const urlInput = document.getElementById('post-image-input');
  if (post.image && post.image.startsWith('data:')) {
    previewImg.src = post.image;
    previewBox.style.display = 'block';
    urlInput.value = '';
  } else {
    urlInput.value = post.image || '';
    previewBox.style.display = 'none';
  }

  // Trigger markdown preview
  const postPreviewEl = document.getElementById('post-markdown-preview');
  if (postPreviewEl && typeof parseMarkdown === 'function') {
    postPreviewEl.innerHTML = parseMarkdown(post.content);
  }

  document.getElementById('cancel-post-edit').style.display = 'inline-flex';
}

function deletePost(id) {
  if (confirm('Are you sure you want to delete this blog post?')) {
    posts = posts.filter(p => p.id !== id);
    savePostsToStorage();
    renderAdminPosts();
    updateDashboardStats();
    showToast('Blog post deleted successfully.');
    if (editingPostId === id) resetPostForm();
  }
}

function resetPostForm() {
  editingPostId = null;
  document.getElementById('admin-post-form-title').textContent = 'Add New Blog Post';
  document.getElementById('post-form').reset();
  document.getElementById('post-date-input').value = new Date().toISOString().split('T')[0];
  document.getElementById('post-markdown-preview').innerHTML = '<p class="text-muted">Type markdown content to see live preview...</p>';
  document.getElementById('cancel-post-edit').style.display = 'none';
  // Clear image preview
  const previewBox = document.getElementById('post-image-preview');
  const previewImg = document.getElementById('post-image-preview-img');
  if (previewBox) previewBox.style.display = 'none';
  if (previewImg) previewImg.src = '';
}

function savePostsToStorage() {
  localStorage.setItem('portfolio_posts', JSON.stringify(posts));
}

/**
 * Settings & GitHub Integration Logic
 */
function setupSyncAndGitHub() {
  const dlProjectsBtn = document.getElementById('btn-download-projects');
  const dlPostsBtn = document.getElementById('btn-download-posts');
  const syncForm = document.getElementById('github-sync-form');
  const testSyncBtn = document.getElementById('btn-test-github');
  const commitSyncBtn = document.getElementById('btn-commit-github');

  // Load saved github credentials
  const savedOwner = localStorage.getItem('gh_owner') || '';
  const savedRepo = localStorage.getItem('gh_repo') || '';
  const savedBranch = localStorage.getItem('gh_branch') || 'main';
  const savedPat = localStorage.getItem('gh_pat') || '';

  if (syncForm) {
    document.getElementById('gh-owner').value = savedOwner;
    document.getElementById('gh-repo').value = savedRepo;
    document.getElementById('gh-branch').value = savedBranch;
    document.getElementById('gh-pat').value = savedPat;

    syncForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const owner = document.getElementById('gh-owner').value.trim();
      const repo = document.getElementById('gh-repo').value.trim();
      const branch = document.getElementById('gh-branch').value.trim();
      const pat = document.getElementById('gh-pat').value.trim();

      localStorage.setItem('gh_owner', owner);
      localStorage.setItem('gh_repo', repo);
      localStorage.setItem('gh_branch', branch);
      localStorage.setItem('gh_pat', pat);

      showToast('GitHub configuration saved locally.');
    });
  }

  // 1. Download Buttons
  if (dlProjectsBtn) {
    dlProjectsBtn.addEventListener('click', () => {
      downloadJSONFile(projects, 'projects.json');
    });
  }

  if (dlPostsBtn) {
    dlPostsBtn.addEventListener('click', () => {
      downloadJSONFile(posts, 'posts.json');
    });
  }

  // 2. Test Connection Button
  if (testSyncBtn) {
    testSyncBtn.addEventListener('click', async () => {
      const credentials = getGitHubCredentials();
      if (!credentials) return;

      updateStatusIndicator('pending', 'Testing connection...');
      try {
        const response = await fetch(`https://api.github.com/repos/${credentials.owner}/${credentials.repo}`, {
          headers: {
            'Authorization': `token ${credentials.pat}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (response.ok) {
          updateStatusIndicator('success', 'Connected! Repository exists and token is valid.');
          showToast('Connection verified successfully.');
        } else {
          const errData = await response.json();
          updateStatusIndicator('error', `Error: ${errData.message || response.statusText}`);
        }
      } catch (error) {
        updateStatusIndicator('error', `Network Error: ${error.message}`);
      }
    });
  }

  // 3. Commit Direct Button
  if (commitSyncBtn) {
    commitSyncBtn.addEventListener('click', async () => {
      const credentials = getGitHubCredentials();
      if (!credentials) return;

      if (!confirm('This will commit the current Projects and Blog Posts directly to your GitHub repository. Proceed?')) {
        return;
      }

      updateStatusIndicator('pending', 'Committing files to GitHub...');

      try {
        // Sync projects.json
        const projSuccess = await commitFileToGitHub(
          credentials,
          'data/projects.json',
          JSON.stringify(projects, null, 2),
          'Update projects.json from portfolio admin panel'
        );

        if (!projSuccess) {
          updateStatusIndicator('error', 'Failed to commit data/projects.json');
          return;
        }

        // Sync posts.json
        const postsSuccess = await commitFileToGitHub(
          credentials,
          'data/posts.json',
          JSON.stringify(posts, null, 2),
          'Update posts.json from portfolio admin panel'
        );

        if (postsSuccess) {
          updateStatusIndicator('success', 'Successfully committed all changes to GitHub!');
          showToast('GitHub repository updated.');
        } else {
          updateStatusIndicator('error', 'Failed to commit data/posts.json');
        }
      } catch (err) {
        updateStatusIndicator('error', `Error: ${err.message}`);
      }
    });
  }
}

function getGitHubCredentials() {
  const owner = document.getElementById('gh-owner').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  const branch = document.getElementById('gh-branch').value.trim() || 'main';
  const pat = document.getElementById('gh-pat').value.trim();

  if (!owner || !repo || !pat) {
    alert('Please fill out Owner, Repo Name, and Personal Access Token (PAT).');
    return null;
  }

  return { owner, repo, branch, pat };
}

function updateStatusIndicator(state, message) {
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');

  if (!dot || !text) return;

  dot.className = 'status-dot';
  dot.classList.add(state);
  text.textContent = message;
}

/**
 * Downloads a file locally
 */
function downloadJSONFile(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Commits a file to GitHub repository using REST API
 */
async function commitFileToGitHub(creds, path, content, commitMessage) {
  const url = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${path}`;
  
  // Step 1: Try to get the current file to obtain its SHA (needed for updates)
  let sha = null;
  try {
    const res = await fetch(`${url}?ref=${creds.branch}`, {
      headers: {
        'Authorization': `token ${creds.pat}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    } else if (res.status !== 404) {
      // Any error other than 404 (file does not exist yet) is a real failure
      const errData = await res.json();
      throw new Error(`Failed to fetch file metadata: ${errData.message || res.statusText}`);
    }
  } catch (error) {
    console.error(`Error fetching SHA for ${path}:`, error);
    throw error;
  }

  // Step 2: Push/PUT the updated content
  // Base64 encode file content safely (handles Unicode/UTF-8)
  const base64Content = btoa(unescape(encodeURIComponent(content)));

  const payload = {
    message: commitMessage,
    content: base64Content,
    branch: creds.branch
  };

  if (sha) {
    payload.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${creds.pat}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`GitHub API Commit failed: ${errData.message || res.statusText}`);
  }

  return true;
}

/**
 * Custom toast alert slide in/out
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// Make globally accessible for onclick events in generated HTML
window.editProject = editProject;
window.deleteProject = deleteProject;
window.editPost = editPost;
window.deletePost = deletePost;
window.logout = logout;
window.clearProjectImage = clearProjectImage;
window.clearPostImage = clearPostImage;

/**
 * Image upload setup for project and post forms
 * Converts uploaded files to base64 data URLs for storage in LocalStorage
 */
function setupImageUpload() {
  // Project image file upload
  const projFileInput = document.getElementById('proj-image-file');
  if (projFileInput) {
    projFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewBox = document.getElementById('proj-image-preview');
        const previewImg = document.getElementById('proj-image-preview-img');
        const urlInput = document.getElementById('proj-image');
        previewImg.src = event.target.result;
        previewBox.style.display = 'block';
        urlInput.value = ''; // clear URL field when file is uploaded
      };
      reader.readAsDataURL(file);
    });
  }

  // Post image file upload
  const postFileInput = document.getElementById('post-image-file');
  if (postFileInput) {
    postFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewBox = document.getElementById('post-image-preview');
        const previewImg = document.getElementById('post-image-preview-img');
        const urlInput = document.getElementById('post-image-input');
        previewImg.src = event.target.result;
        previewBox.style.display = 'block';
        urlInput.value = ''; // clear URL field when file is uploaded
      };
      reader.readAsDataURL(file);
    });
  }
}

function clearProjectImage() {
  const previewBox = document.getElementById('proj-image-preview');
  const previewImg = document.getElementById('proj-image-preview-img');
  const fileInput = document.getElementById('proj-image-file');
  if (previewBox) previewBox.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
}

function clearPostImage() {
  const previewBox = document.getElementById('post-image-preview');
  const previewImg = document.getElementById('post-image-preview-img');
  const fileInput = document.getElementById('post-image-file');
  if (previewBox) previewBox.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
}
