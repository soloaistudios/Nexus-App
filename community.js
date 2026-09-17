'use strict';

/*
 * NEXUS Community Module
 * ----------------------
 * Private community interface for the NEXUS app.
 *
 * Handles:
 * - Community feed
 * - Posts
 * - Likes
 * - Comments
 * - Official announcements
 * - Search
 * - Local persistence
 *
 * This module does not connect to an external
 * social network or API.
 */

(() => {
  const STORAGE_KEY =
    'nexusSimulatorState';

  const SEEDED_POSTS = [
    {
      id: 'POST-001',

      author: 'NEXUS Team',

      role: 'Official',

      avatar: 'N',

      text:
        'Welcome to the NEXUS community. Stay connected, explore trading activity, and follow the latest platform updates.',

      timestamp:
        Date.now() - 1000 * 60 * 20,

      likes: 24,

      liked: false,

      official: true,

      comments: [
        {
          id: 'COMMENT-001',

          author: 'Marcus',

          text:
            'Glad to be here.',

          timestamp:
            Date.now() -
            1000 * 60 * 12,
        },
      ],
    },

    {
      id: 'POST-002',

      author: 'Alex',

      role: 'Member',

      avatar: 'A',

      text:
        'The trading dashboard makes it easy to keep track of an active cycle and review recent activity.',

      timestamp:
        Date.now() - 1000 * 60 * 48,

      likes: 12,

      liked: false,

      official: false,

      comments: [],
    },

    {
      id: 'POST-003',

      author: 'Diana',

      role: 'Member',

      avatar: 'D',

      text:
        'The community updates are really easy to follow. Everything feels organized in one feed.',

      timestamp:
        Date.now() - 1000 * 60 * 95,

      likes: 8,

      liked: false,

      official: false,

      comments: [],
    },
  ];

  function defaultState() {
    return {
      loggedIn: false,

      user: {
        name: 'Trader Account',

        email:
          'demo@nexus.local',

        verified: false,

        inviteCode: '',
      },

      balance: 0,

      selectedPlan: 'daily',

      activeTrade: null,

      tradeHistory: [],

      transactions: [],

      communityPosts: [],

      notifications: 2,

      firstRun: true,

      tourSeen: false,

      tourStep: 0,

      settings: {
        notifications: true,

        dark: true,
      },
    };
  }

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function loadState() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return defaultState();
      }

      const parsed =
        JSON.parse(raw);

      return {
        ...defaultState(),

        ...parsed,

        user: {
          ...defaultState().user,

          ...(parsed.user || {}),
        },

        settings: {
          ...defaultState().settings,

          ...(parsed.settings || {}),
        },

        tradeHistory:
          Array.isArray(
            parsed.tradeHistory
          )
            ? parsed.tradeHistory
            : [],

        transactions:
          Array.isArray(
            parsed.transactions
          )
            ? parsed.transactions
            : [],

        communityPosts:
          Array.isArray(
            parsed.communityPosts
          )
            ? parsed.communityPosts
            : [],
      };
    } catch (error) {
      console.warn(
        'NEXUS community: state could not be loaded.',
        error
      );

      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,

        JSON.stringify(
          state
        )
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS community: state could not be saved.',
        error
      );

      return false;
    }
  }

  function ensureSeedPosts() {
    const state =
      loadState();

    if (
      !Array.isArray(
        state.communityPosts
      ) ||
      state.communityPosts.length ===
        0
    ) {
      state.communityPosts =
        clone(
          SEEDED_POSTS
        );

      saveState(
        state
      );
    }

    return state;
  }

  function getCurrentUser() {
    const state =
      loadState();

    return (
      state.user?.name ||
      'Trader Account'
    );
  }

  function getInitials(name) {
    const cleanName =
      String(
        name ||
          'Trader Account'
      ).trim();

    if (!cleanName) {
      return 'T';
    }

    const parts =
      cleanName.split(
        /\s+/
      );

    if (
      parts.length ===
      1
    ) {
      return parts[0]
        .charAt(0)
        .toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[
        parts.length - 1
      ].charAt(0)
    ).toUpperCase();
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}`;
  }

  function timeAgo(timestamp) {
    const difference =
      Math.max(
        0,

        Date.now() -
          Number(timestamp)
      );

    const seconds =
      Math.floor(
        difference / 1000
      );

    if (
      seconds < 60
    ) {
      return 'Just now';
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    if (
      minutes < 60
    ) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (
      hours < 24
    ) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (
      days < 7
    ) {
      return `${days}d ago`;
    }

    return new Intl.DateTimeFormat(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
      }
    ).format(
      new Date(
        timestamp
      )
    );
  }

  function showToast(message) {
    if (
      window.NexusApp?.toast
    ) {
      window.NexusApp.toast(
        message
      );

      return;
    }

    const wrapper =
      document.getElementById(
        'toastWrap'
      );

    if (!wrapper) {
      console.info(
        `NEXUS community: ${message}`
      );

      return;
    }

    const toast =
      document.createElement(
        'div'
      );

    toast.className =
      'toast';

    toast.textContent =
      message;

    wrapper.appendChild(
      toast
    );

    window.setTimeout(
      () => {
        toast.remove();
      },

      3000
    );
  }

  function findPost(
    state,
    postId
  ) {
    return state.communityPosts.find(
      (post) =>
        post.id === postId
    );
  }

  function createPost(text) {
    const state =
      ensureSeedPosts();

    if (!state.loggedIn) {
      return {
        success: false,

        message:
          'Sign in to post in the community.',
      };
    }

    const cleanText =
      String(
        text || ''
      ).trim();

    if (!cleanText) {
      return {
        success: false,

        message:
          'Write something before posting.',
      };
    }

    if (
      cleanText.length >
      1000
    ) {
      return {
        success: false,

        message:
          'Posts must be 1000 characters or fewer.',
      };
    }

    const post = {
      id:
        createId('POST'),

      author:
        getCurrentUser(),

      role:
        'Member',

      avatar:
        getInitials(
          getCurrentUser()
        ),

      text:
        cleanText,

      timestamp:
        Date.now(),

      likes: 0,

      liked: false,

      official: false,

      comments: [],
    };

    state.communityPosts.unshift(
      post
    );

    state.communityPosts =
      state.communityPosts.slice(
        0,
        100
      );

    saveState(
      state
    );

    render();

    dispatch(
      'nexus:community-post-created',

      {
        post,
      }
    );

    return {
      success: true,

      post,
    };
  }

  function toggleLike(postId) {
    const state =
      ensureSeedPosts();

    const post =
      findPost(
        state,
        postId
      );

    if (!post) {
      return {
        success: false,

        message:
          'Post could not be found.',
      };
    }

    const liked =
      Boolean(
        post.liked
      );

    post.liked =
      !liked;

    post.likes =
      Math.max(
        0,

        Number(
          post.likes
        ) +
          (
            post.liked
              ? 1
              : -1
          )
      );

    saveState(
      state
    );

    render();

    return {
      success: true,

      liked:
        post.liked,

      likes:
        post.likes,
    };
  }

  function addComment(
    postId,
    text
  ) {
    const state =
      ensureSeedPosts();

    if (!state.loggedIn) {
      return {
        success: false,

        message:
          'Sign in to comment.',
      };
    }

    const post =
      findPost(
        state,
        postId
      );

    if (!post) {
      return {
        success: false,

        message:
          'Post could not be found.',
      };
    }

    const cleanText =
      String(
        text || ''
      ).trim();

    if (!cleanText) {
      return {
        success: false,

        message:
          'Write a comment first.',
      };
    }

    if (
      cleanText.length >
      500
    ) {
      return {
        success: false,

        message:
          'Comments must be 500 characters or fewer.',
      };
    }

    if (
      !Array.isArray(
        post.comments
      )
    ) {
      post.comments =
        [];
    }

    const comment = {
      id:
        createId('COMMENT'),

      author:
        getCurrentUser(),

      text:
        cleanText,

      timestamp:
        Date.now(),
    };

    post.comments.push(
      comment
    );

    post.comments =
      post.comments.slice(
        -50
      );

    saveState(
      state
    );

    render();

    dispatch(
      'nexus:community-comment-created',

      {
        postId,

        comment,
      }
    );

    return {
      success: true,

      comment,
    };
  }

  function deletePost(postId) {
    const state =
      ensureSeedPosts();

    const post =
      findPost(
        state,
        postId
      );

    if (!post) {
      return {
        success: false,

        message:
          'Post could not be found.',
      };
    }

    if (post.official) {
      return {
        success: false,

        message:
          'Official posts cannot be removed.',
      };
    }

    if (
      post.author !==
      getCurrentUser()
    ) {
      return {
        success: false,

        message:
          'You can only remove your own posts.',
      };
    }

    state.communityPosts =
      state.communityPosts.filter(
        (item) =>
          item.id !==
          postId
      );

    saveState(
      state
    );

    render();

    return {
      success: true,
    };
  }

  function searchPosts(
    query
  ) {
    const state =
      ensureSeedPosts();

    const cleanQuery =
      String(
        query || ''
      )
        .trim()
        .toLowerCase();

    if (!cleanQuery) {
      return state.communityPosts;
    }

    return state.communityPosts.filter(
      (post) => {
        const author =
          String(
            post.author || ''
          ).toLowerCase();

        const text =
          String(
            post.text || ''
          ).toLowerCase();

        return (
          author.includes(
            cleanQuery
          ) ||
          text.includes(
            cleanQuery
          )
        );
      }
    );
  }

  function createPostElement(
    post
  ) {
    const article =
      document.createElement(
        'article'
      );

    article.className =
      'community-post';

    article.dataset.postId =
      post.id;

    const header =
      document.createElement(
        'div'
      );

    header.className =
      'community-post-header';

    const avatar =
      document.createElement(
        'div'
      );

    avatar.className =
      'community-avatar';

    avatar.textContent =
      post.avatar ||
      getInitials(
        post.author
      );

    const authorGroup =
      document.createElement(
        'div'
      );

    authorGroup.className =
      'community-author';

    const author =
      document.createElement(
        'strong'
      );

    author.textContent =
      post.author ||
      'Member';

    const meta =
      document.createElement(
        'span'
      );

    meta.textContent =
      `${post.role || 'Member'} · ${timeAgo(
        post.timestamp
      )}`;

    authorGroup.append(
      author,
      meta
    );

    header.append(
      avatar,
      authorGroup
    );

    if (post.official) {
      const badge =
        document.createElement(
          'span'
        );

      badge.className =
        'community-official-badge';

      badge.textContent =
        'Official';

      header.appendChild(
        badge
      );
    }

    const body =
      document.createElement(
        'div'
      );

    body.className =
      'community-post-body';

    const text =
      document.createElement(
        'p'
      );

    text.textContent =
      post.text || '';

    body.appendChild(
      text
    );

    const actions =
      document.createElement(
        'div'
      );

    actions.className =
      'community-post-actions';

    const likeButton =
      document.createElement(
        'button'
      );

    likeButton.type =
      'button';

    likeButton.className =
      'community-action';

    likeButton.dataset.communityLike =
      post.id;

    likeButton.setAttribute(
      'aria-pressed',

      String(
        Boolean(
          post.liked
        )
      )
    );

    likeButton.textContent =
      post.liked
        ? `Liked ${post.likes}`
        : `Like ${post.likes}`;

    const commentButton =
      document.createElement(
        'button'
      );

    commentButton.type =
      'button';

    commentButton.className =
      'community-action';

    commentButton.dataset.communityComments =
      post.id;

    const commentCount =
      Array.isArray(
        post.comments
      )
        ? post.comments.length
        : 0;

    commentButton.textContent =
      `Comments ${commentCount}`;

    actions.append(
      likeButton,
      commentButton
    );

    const commentSection =
      document.createElement(
        'div'
      );

    commentSection.className =
      'community-comment-box hidden';

    commentSection.dataset.commentBox =
      post.id;

    const comments =
      Array.isArray(
        post.comments
      )
        ? post.comments
        : [];

    comments
      .slice(-5)
      .forEach(
        (comment) => {
          const row =
            document.createElement(
              'div'
            );

          row.className =
            'community-comment';

          const commentAuthor =
            document.createElement(
              'strong'
            );

          commentAuthor.textContent =
            comment.author ||
            'Member';

          const commentText =
            document.createElement(
              'span'
            );

          commentText.textContent =
            comment.text || '';

          row.append(
            commentAuthor,
            commentText
          );

          commentSection.appendChild(
            row
          );
        }
      );

    const commentForm =
      document.createElement(
        'form'
      );

    commentForm.className =
      'community-comment-form';

    commentForm.dataset.commentForm =
      post.id;

    const commentInput =
      document.createElement(
        'input'
      );

    commentInput.type =
      'text';

    commentInput.required =
      true;

    commentInput.maxLength =
      500;

    commentInput.autocomplete =
      'off';

    commentInput.placeholder =
      'Write a comment...';

    const commentSubmit =
      document.createElement(
        'button'
      );

    commentSubmit.type =
      'submit';

    commentSubmit.textContent =
      'Send';

    commentForm.append(
      commentInput,
      commentSubmit
    );

    commentSection.appendChild(
      commentForm
    );

    article.append(
      header,
      body,
      actions,
      commentSection
    );

    return article;
  }

  function renderFeed(
    container,
    posts
  ) {
    if (!container) {
      return;
    }

    container.innerHTML =
      '';

    if (
      posts.length ===
      0
    ) {
      const empty =
        document.createElement(
          'div'
        );

      empty.className =
        'empty-state';

      empty.textContent =
        'No posts found.';

      container.appendChild(
        empty
      );

      return;
    }

    posts.forEach(
      (post) => {
        container.appendChild(
          createPostElement(
            post
          )
        );
      }
    );
  }

  function render() {
    const state =
      ensureSeedPosts();

    const search =
      document.querySelector(
        '[data-community-search]'
      );

    const query =
      search?.value || '';

    const posts =
      searchPosts(
        query
      );

    document
      .querySelectorAll(
        '[data-community-feed]'
      )
      .forEach(
        (container) => {
          renderFeed(
            container,
            posts
          );
        }
      );

    document
      .querySelectorAll(
        '[data-community-member-name]'
      )
      .forEach(
        (element) => {
          element.textContent =
            getCurrentUser();
        }
      );

    document
      .querySelectorAll(
        '[data-community-member-avatar]'
      )
      .forEach(
        (element) => {
          element.textContent =
            getInitials(
              getCurrentUser()
            );
        }
      );

    document
      .querySelectorAll(
        '[data-community-count]'
      )
      .forEach(
        (element) => {
          element.textContent =
            String(
              state.communityPosts.length
            );
        }
      );
  }

  function handlePostSubmit(
    event
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const input =
      form.querySelector(
        '[data-community-post-input]'
      );

    const result =
      createPost(
        input?.value || ''
      );

    if (!result.success) {
      showToast(
        result.message
      );

      return;
    }

    if (input) {
      input.value =
        '';
    }

    showToast(
      'Post published.'
    );
  }

  function handleFeedClick(
    event
  ) {
    const likeButton =
      event.target.closest(
        '[data-community-like]'
      );

    if (likeButton) {
      const result =
        toggleLike(
          likeButton.dataset
            .communityLike
        );

      if (!result.success) {
        showToast(
          result.message
        );
      }

      return;
    }

    const commentButton =
      event.target.closest(
        '[data-community-comments]'
      );

    if (!commentButton) {
      return;
    }

    const postId =
      commentButton.dataset
        .communityComments;

    const commentBox =
      event.currentTarget.querySelector(
        `[data-comment-box="${postId}"]`
      );

    if (!commentBox) {
      return;
    }

    commentBox.classList.toggle(
      'hidden'
    );

    if (
      !commentBox.classList.contains(
        'hidden'
      )
    ) {
      window.setTimeout(
        () => {
          commentBox
            .querySelector(
              'input'
            )
            ?.focus();
        },
        40
      );
    }
  }

  function handleCommentSubmit(
    event
  ) {
    event.preventDefault();

    const form =
      event.target;

    const postId =
      form.dataset.commentForm;

    const input =
      form.querySelector(
        'input'
      );

    const result =
      addComment(
        postId,
        input?.value || ''
      );

    if (!result.success) {
      showToast(
        result.message
      );

      return;
    }

    showToast(
      'Comment added.'
    );
  }

  function bindEvents() {
    document
      .querySelectorAll(
        '[data-community-post-form]'
      )
      .forEach(
        (form) => {
          if (
            form.dataset.bound ===
            'true'
          ) {
            return;
          }

          form.dataset.bound =
            'true';

          form.addEventListener(
            'submit',
            handlePostSubmit
          );
        }
      );

    document
      .querySelectorAll(
        '[data-community-feed]'
      )
      .forEach(
        (feed) => {
          if (
            feed.dataset.bound ===
            'true'
          ) {
            return;
          }

          feed.dataset.bound =
            'true';

          feed.addEventListener(
            'click',
            handleFeedClick
          );

          feed.addEventListener(
            'submit',
            handleCommentSubmit
          );
        }
      );

    document
      .querySelectorAll(
        '[data-community-search]'
      )
      .forEach(
        (input) => {
          if (
            input.dataset.bound ===
            'true'
          ) {
            return;
          }

          input.dataset.bound =
            'true';

          input.addEventListener(
            'input',
            render
          );
        }
      );

    window.addEventListener(
      'nexus:profile-updated',
      render
    );

    window.addEventListener(
      'nexus:auth-updated',
      render
    );

    window.addEventListener(
      'nexus:trade-completed',
      () => {
        render();
      }
    );
  }

  function dispatch(
    eventName,
    detail
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(
          eventName,
          {
            detail,
          }
        )
      );
    } catch (error) {
      console.debug(
        'NEXUS community event skipped.',
        error
      );
    }
  }

  function init() {
    ensureSeedPosts();

    bindEvents();

    render();
  }

  window.NexusCommunity = {
    init,

    render,

    loadState,

    saveState,

    createPost,

    toggleLike,

    addComment,

    deletePost,

    searchPosts,
  };

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true,
      }
    );
  } else {
    init();
  }
})();
