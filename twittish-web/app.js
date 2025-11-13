// Twittish — client-side demo platform
(() => {
  const state = {
    user: null,              // { id, email, username, display, bio, avatar }
    users: [],               // list of users
    posts: [],               // list of posts
    notifications: [],       // { id, userId, type, actorUsername, postId?, createdAt, read }
    route: "home",           // "home" | "latest" | "search" | "profile:@user" | "thread:<id>"
    composeText: "",
    composeMediaUrl: "",
    filter: { mediaOnly: false }
  };

  // Storage
  const LS_KEY = "twittish_web_v1";
  function load() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return seed();
    try {
      const data = JSON.parse(raw);
      Object.assign(state, data);
    } catch { seed(); }
  }
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
  function seed() {
    state.users = [
      { id: id(), email: "alice@example.com", username: "alice", display: "Alice", bio: "Front-end dev", avatar: "" },
      { id: id(), email: "bob@example.com", username: "bob", display: "Bob", bio: "Game designer", avatar: "" }
    ];
    state.user = state.users[0];
    state.posts = [
      mkPost("alice", "Hello Twittish! #firstpost", ""),
      mkPost("bob", "Working on level design today. @alice #gamedev", "https://picsum.photos/seed/level/800/400")
    ];
    state.notifications = [];
    state.route = "home";
    save();
  }

  function id() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function now() { return new Date().toISOString(); }
  function mkPost(username, content, mediaUrl = "", inReplyToId = null) {
    const author = getUser(username);
    return {
      id: id(),
      authorUsername: username,
      authorDisplay: author?.display || username,
      authorAvatar: author?.avatar || "",
      content,
      mediaUrl,
      inReplyToId,
      createdAt: now(),
      likes: [],
      replies: [] // array of post IDs
    };
  }

  // Helpers
  function getUser(username) { return state.users.find(u => u.username === username); }
  function ensureUser(username) {
    let u = getUser(username);
    if (!u) {
      u = { id: id(), email: "", username, display: username, bio: "", avatar: "" };
      state.users.push(u);
    }
    return u;
  }
  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString();
  }
  function extractTags(text) {
    return Array.from(new Set(text.split(/\s+/).filter(w => /^#\w/.test(w)).map(w => w.slice(1).toLowerCase())));
  }
  function extractMentions(text) {
    return Array.from(new Set(text.split(/\s+/).filter(w => /^@\w/.test(w)).map(w => w.slice(1))));
  }

  // Router
  const routeButtons = document.querySelectorAll(".navlink");
  routeButtons.forEach(btn => btn.addEventListener("click", () => {
    const r = btn.getAttribute("data-route");
    openRoute(r);
  }));

  function openRoute(r) {
    state.route = r;
    closeModals();
    render();
  }

  // Auth UI
  const authedActions = document.getElementById("authed-actions");
  const guestActions = document.getElementById("guest-actions");
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", () => {
    state.user = null;
    save();
    render();
  });

  // Composer
  const composer = document.getElementById("composer");
  const composeInput = document.getElementById("compose-input");
  const charCount = document.getElementById("char-count");
  const mediaUrlInput = document.getElementById("media-url");
  const postBtn = document.getElementById("post-btn");

  composeInput.addEventListener("input", () => {
    state.composeText = composeInput.value;
    charCount.textContent = `${state.composeText.length}/280`;
  });
  mediaUrlInput.addEventListener("input", () => {
    state.composeMediaUrl = mediaUrlInput.value;
  });
  postBtn.addEventListener("click", () => {
    const txt = state.composeText.trim();
    if (!state.user) return alert("Login to post");
    if (!txt) return;
    const p = mkPost(state.user.username, txt, state.composeMediaUrl.trim());
    state.posts.unshift(p);

    // Notify mentioned users
    const mentions = extractMentions(txt);
    mentions.forEach(m => {
      ensureUser(m);
      state.notifications.push({
        id: id(),
        userId: getUser(m).id,
        type: "mention",
        actorUsername: state.user.username,
        postId: p.id,
        createdAt: now(),
        read: false
      });
    });

    state.composeText = "";
    state.composeMediaUrl = "";
    composeInput.value = "";
    mediaUrlInput.value = "";
    charCount.textContent = "0/280";
    save();
    render();
  });

  // Notifications
  const notifBtn = document.getElementById("notif-btn");
  const notifBadge = document.getElementById("notif-badge");
  notifBtn.addEventListener("click", () => openNotifications());

  function openNotifications() {
    const myNotifs = state.notifications.filter(n => state.user && n.userId === state.user.id);
    const modal = document.getElementById("search-modal"); // reuse modal shell for list
    const overlay = document.getElementById("modal-overlay");
    const title = modal.querySelector(".modal-header h3");
    const body = document.getElementById("search-results");
    title.textContent = "Notifications";
    body.innerHTML = "";
    myNotifs.forEach(n => {
      const row = document.createElement("div"); row.className = "card";
      const typeText = n.type === "like" ? "liked your post" :
                       n.type === "reply" ? "replied to your post" :
                       n.type === "mention" ? "mentioned you" :
                       n.type === "follow" ? "followed you" : n.type;
      row.innerHTML = `<div class="row space">
        <div>@${n.actorUsername} ${typeText}</div>
        <div class="muted sm">${formatTime(n.createdAt)}</div>
      </div>`;
      body.appendChild(row);
    });
    overlay.style.display = "block";
    modal.style.display = "block";
    // mark read
    myNotifs.forEach(n => n.read = true);
    save();
    renderHeader();
  }

  // Profile modal
  const profileBtn = document.getElementById("profile-btn");
  const profileModal = document.getElementById("profile-modal");
  const profileDisplay = document.getElementById("profile-display");
  const profileBio = document.getElementById("profile-bio");
  const profileAvatar = document.getElementById("profile-avatar");
  const profileSave = document.getElementById("profile-save");

  profileBtn.addEventListener("click", () => {
    if (!state.user) return alert("Login first");
    profileDisplay.value = state.user.display || "";
    profileBio.value = state.user.bio || "";
    profileAvatar.value = state.user.avatar || "";
    openModal(profileModal);
  });

  profileSave.addEventListener("click", () => {
    if (!state.user) return;
    state.user.display = profileDisplay.value.trim();
    state.user.bio = profileBio.value.trim();
    state.user.avatar = profileAvatar.value.trim();
    const idx = state.users.findIndex(u => u.id === state.user.id);
    state.users[idx] = { ...state.user };
    save();
    closeModals();
    render();
  });

  // Auth modal (login/register)
  const authModal = document.getElementById("auth-modal");
  const authTitle = document.getElementById("auth-title");
  const loginOpen = document.getElementById("login-open");
  const registerOpen = document.getElementById("register-open");
  const authEmail = document.getElementById("auth-email");
  const authUsername = document.getElementById("auth-username");
  const authPassword = document.getElementById("auth-password");
  const authSubmit = document.getElementById("auth-submit");

  loginOpen.addEventListener("click", () => {
    authTitle.textContent = "Login";
    authEmail.value = ""; authUsername.value = ""; authPassword.value = "";
    openModal(authModal);
  });
  registerOpen.addEventListener("click", () => {
    authTitle.textContent = "Register";
    authEmail.value = ""; authUsername.value = ""; authPassword.value = "";
    openModal(authModal);
  });

  authSubmit.addEventListener("click", () => {
    const mode = authTitle.textContent;
    const email = authEmail.value.trim();
    const username = authUsername.value.trim();
    const password = authPassword.value.trim();
    if (!password || (!email && !username)) return alert("Missing fields");

    if (mode === "Register") {
      if (!email || !username) return alert("Email and username required");
      if (getUser(username)) return alert("Username taken");
      const u = { id: id(), email, username, display: username, bio: "", avatar: "", pass: password };
      state.users.push(u);
      state.user = u;
    } else { // Login
      const u = username ? getUser(username) : state.users.find(x => x.email === email);
      if (!u) return alert("User not found");
      if ((u.pass ?? "") !== password) return alert("Wrong password");
      state.user = u;
    }
    save();
    closeModals();
    render();
  });

  // Search modal
  const searchModal = document.getElementById("search-modal");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");

  document.querySelectorAll('[data-route="search"]').forEach(btn => {
    btn.addEventListener("click", () => {
      searchInput.value = "";
      searchResults.innerHTML = "";
      openModal(searchModal);
    });
  });

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";
    if (!q) return;

    // users
    const users = state.users.filter(u =>
      (u.username.toLowerCase().includes(q) || (u.display||"").toLowerCase().includes(q))
    );
    if (users.length) {
      const h = document.createElement("div"); h.className = "muted"; h.textContent = "Users";
      searchResults.appendChild(h);
      users.slice(0,10).forEach(u => {
        const row = document.createElement("div"); row.className = "card row space";
        row.innerHTML = `<div class="row gap">
          <img class="avatar" src="${u.avatar||placeholder(u.username)}" />
          <div><div class="username">@${u.username}</div><div class="muted sm">${u.display||""}</div></div>
        </div>
        <button class="btn">View</button>`;
        row.querySelector(".btn").addEventListener("click", () => {
          closeModals();
          openProfileTimeline(u.username);
        });
        searchResults.appendChild(row);
      });
    }

    // posts
    const posts = state.posts.filter(p =>
      p.content.toLowerCase().includes(q) ||
      extractTags(p.content).some(t => t.includes(q))
    );
    if (posts.length) {
      const h = document.createElement("div"); h.className = "muted"; h.textContent = "Posts";
      searchResults.appendChild(h);
      posts.slice(0,20).forEach(p => searchResults.appendChild(renderPostNode(p)));
    }
  });

  // Modals util
  const overlay = document.getElementById("modal-overlay");
  document.querySelectorAll(".modal .close").forEach(btn => {
    btn.addEventListener("click", closeModals);
  });
  overlay.addEventListener("click", closeModals);
  function openModal(el) { overlay.style.display = "block"; el.style.display = "block"; }
  function closeModals() {
    overlay.style.display = "none";
    [authModal, profileModal, searchModal].forEach(m => m.style.display = "none");
  }

  // Rendering
  const feed = document.getElementById("feed");

  function render() {
    renderHeader();
    renderComposer();
    renderFeed();
  }

  function renderHeader() {
    const unread = state.user ? state.notifications.filter(n => n.userId === state.user.id && !n.read).length : 0;
    notifBadge.textContent = String(unread);
    notifBadge.style.display = unread ? "inline-block" : "none";

    if (state.user) {
      authedActions.style.display = "flex";
      guestActions.style.display = "none";
    } else {
      authedActions.style.display = "none";
      guestActions.style.display = "flex";
    }
  }

  function renderComposer() {
    composer.style.display = state.user ? "block" : "none";
  }

  function renderFeed() {
    feed.innerHTML = "";
    let posts = [];

    if (state.route === "home") {
      // For demo: home = posts by current user + mentioned users + everyone (could filter)
      posts = [...state.posts];
    } else if (state.route === "latest") {
      posts = [...state.posts];
    } else if (state.route.startsWith("profile:@")) {
      const username = state.route.slice("profile:@".length);
      posts = state.posts.filter(p => p.authorUsername === username);
    } else if (state.route.startsWith("thread:")) {
      const id = state.route.slice("thread:".length);
      const root = state.posts.find(p => p.id === id);
      if (root) {
        posts = [root, ...state.posts.filter(p => p.inReplyToId === root.id)];
      }
    }

    // Media-only filter demo (toggle if needed)
    if (state.filter.mediaOnly) posts = posts.filter(p => !!p.mediaUrl);

    posts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    posts.forEach(p => feed.appendChild(renderPostNode(p)));
    if (!posts.length) {
      const empty = document.createElement("div");
      empty.className = "card muted";
      empty.textContent = "No posts yet";
      feed.appendChild(empty);
    }
  }

  function renderPostNode(post) {
    const el = document.createElement("article");
    el.className = "post";

    const tags = extractTags(post.content);
    const mentions = extractMentions(post.content);

    const contentHTML = post.content
      .replace(/(#\w+)/g, '<span class="tag">$1</span>')
      .replace(/(@\w+)/g, '<span class="mention">$1</span>');

    el.innerHTML = `
      <div class="post-header">
        <img class="avatar" src="${post.authorAvatar || placeholder(post.authorUsername)}" alt="${post.authorUsername}">
        <div>
          <div class="username">@${post.authorUsername} <span class="muted sm">${post.authorDisplay||""}</span></div>
          <div class="time">${formatTime(post.createdAt)}</div>
        </div>
      </div>
      <div class="post-body">${contentHTML}</div>
      ${post.mediaUrl ? `<img class="post-media" src="${post.mediaUrl}" alt="">` : ""}
      <div class="post-actions">
        <div class="action like"><svg class="icon"><use href="#i-like"/></svg><span>${post.likes.length}</span></div>
        <div class="action reply"><svg class="icon"><use href="#i-reply"/></svg><span>Reply</span></div>
        <div class="action view"><span>View thread</span></div>
      </div>
    `;

    // Like
    el.querySelector(".like").addEventListener("click", () => {
      if (!state.user) return alert("Login to like");
      const has = post.likes.includes(state.user.username);
      if (has) {
        post.likes = post.likes.filter(u => u !== state.user.username);
      } else {
        post.likes.push(state.user.username);
        // notify author
        const author = getUser(post.authorUsername);
        if (author && (!state.user || author.id !== state.user.id)) {
          state.notifications.push({
            id: id(), userId: author.id, type: "like",
            actorUsername: state.user.username, postId: post.id, createdAt: now(), read: false
          });
        }
      }
      save();
      render();
    });

    // Reply
    el.querySelector(".reply").addEventListener("click", () => {
      if (!state.user) return alert("Login to reply");
      const txt = prompt("Your reply:");
      if (!txt) return;
      const r = mkPost(state.user.username, txt, "", post.id);
      state.posts.push(r);
      post.replies.push(r.id);
      // notify author
      const author = getUser(post.authorUsername);
      if (author && author.id !== state.user.id) {
        state.notifications.push({
          id: id(), userId: author.id, type: "reply",
          actorUsername: state.user.username, postId: post.id, createdAt: now(), read: false
        });
      }
      save();
      render();
    });

    // View thread
    el.querySelector(".view").addEventListener("click", () => {
      openThread(post.id);
    });

    // Clickable mentions and tags
    el.querySelectorAll(".mention").forEach(m => {
      m.addEventListener("click", () => {
        const username = m.textContent.replace("@","").trim();
        openProfileTimeline(username);
      });
    });
    el.querySelectorAll(".tag").forEach(t => {
      t.addEventListener("click", () => {
        const tag = t.textContent.replace("#","").trim().toLowerCase();
        filterByTag(tag);
      });
    });

    return el;
  }

  function openProfileTimeline(username) {
    ensureUser(username);
    state.route = "profile:@" + username;
    render();
  }

  function openThread(id) {
    state.route = "thread:" + id;
    render();
  }

  function filterByTag(tag) {
    // Simple search modal showing posts with tag
    searchInput.value = "#" + tag;
    searchInput.dispatchEvent(new Event("input"));
    openModal(searchModal);
  }

  function placeholder(seed) {
    // lightweight avatar placeholder
    const s = encodeURIComponent(seed);
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${s}`;
  }

  // Init
  load();
  render();
})();
      
