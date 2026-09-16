'use strict';

/*
 * NEXUS Community Module
 * ----------------------
 * Simulation-only private community.
 *
 * Handles:
 * - Community feed
 * - Posts
 * - Reactions
 * - Comments
 * - Official announcements
 * - Basic profile information
 * - Local persistence
 *
 * No external social network or API is used.
 */

(function () {
  const STORAGE_KEY = 'nexusSimulatorState';

  const SEED_POSTS = [
    {
      id: 'POST-SEED-001',
      author: 'NEXUS Team',
      role: 'Official',
      avatar: 'N',
      text: 'Welcome to the NEXUS private simulation community. Explore the trading simulator, review simulated activity, and share your experience.',
      timestamp: Date.now() - 1000 * 60 * 18,
      likes: 24,
      liked: false,
      comments: [
        {
          id: 'COMMENT-001',
          author: 'Marcus',
          text: 'Glad to be here.',
          timestamp: Date.now() - 1000 * 60 * 12
        }
      ],
      official: true
    },
    {
      id: 'POST-SEED-002',
      author: 'Alex',
      role: 'Member',
      avatar: 'A',
      text: 'Just finished reviewing the trading dashboard. The activity timeline makes it easy to follow the simulated arbitrage cycle.',
      timestamp: Date.now() - 1000 * 60 * 42,
      likes: 11,
      liked: false,
      comments: [],
      official: false
    },
    {
      id: 'POST-SEED-003',
      author: 'Diana',
      role: 'Member',
      avatar: 'D',
      text: 'The new community area is looking clean. I like having the official updates in the same feed.',
      timestamp: Date.now() - 1000 * 60 * 95,
      likes: 8,
      liked: false,
      comments: [],
      official: false
    }
  ];

  const DEFAULT_STATE = Object.freeze({
    loggedIn: false,

    user: {
      name: 'Trader Account',
      email: 'demo@nexus.local',
      verified: false,
      inviteCode: ''
    },

    balance: 0,
    selectedPlan: 'daily',
    activeTrade: null,
    tradeHistory: [],
    transactions: [],
    communityPosts: [],
    notifications: 2,
    tourSeen: false,
    tourStep: 0,

    settings: {
      notifications: true,
      dark: true
    }
  });

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
        return clone(
          DEFAULT_STATE
        );
      }

      const parsed =
        JSON.parse(raw);

      return {
        ...clone(DEFAULT_STATE),
        ...parsed,

        user: {
          ...clone(
            DEFAULT_STATE.user
          ),
          ...(parsed.user || {})
        },

        settings: {
          ...clone(
            DEFAULT_STATE.settings
          ),
          ...(parsed.settings || {})
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
            : []
      };
    } catch (error) {
      console.warn(
        'NEXUS community: failed to load state.',
        error
      );

      return clone(
        DEFAULT_STATE
      );
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

      return true;
    } catch (error) {
      console.warn(
        'NEXUS community: failed to save state.',
        error
      );

      return false;
    }
  }

  function ensureSeedContent() {
    const state =
      loadState();

    if (
      !Array.isArray(
        state.communityPosts
      )
    ) {
      state.communityPosts =
        [];
    }

    if (
      state.communityPosts.length ===
      0
    ) {
      state.communityPosts =
        clone(
          SEED_POSTS
        );

      saveState(state);
    }

    return state;
  }

  function getCurrentUserName() {
    const state =
      loadState();

    return (
      state.user?.name ||
      'Trader Account'
    );
  }

  function getInitials(name) {
    const safeName =
      String(
        name ||
          'Trader'
      ).trim();

    if (!safeName) {
      return 'T';
    }

    const parts =
      safeName.split(
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
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(
      Math.random() * 1000000
    )}`;
  }

  function escapeText(value) {
    return String(
      value ?? ''
    );
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
        day: 'numeric'
      }
    ).format(
      new Date(timestamp)
    );
  }

  function findPost(
    postId,
    state
  ) {
    return state.communityPosts.find(
      (post) =>
        post.id === postId
    );
  }

  function createPost(
    text
  ) {
    const state =
      ensureSeedContent();

    if (
      !state.loggedIn
    ) {
      return {
        success: false,
        message:
          'Sign in to post in the community.'
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
          'Write something before posting.'
      };
    }

    if (
      cleanText.length >
      1000
    ) {
      return {
        success: false,
        message:
          'Keep community posts under 1000 characters.'
      };
    }

    const post = {
      id:
        createId('POST'),

      author:
        getCurrentUserName(),

      role:
        'Member',

      avatar:
        getInitials(
          getCurrentUserName()
        ),

      text:
        cleanText,

      timestamp:
        Date.now(),

      likes:
        0,

      liked:
        false,

      comments:
        [],

      official:
        false
    };

    state.communityPosts.unshift(
      post
    );

    state.communityPosts =
      state.communityPosts.slice(
        0,
        100
      );

    saveState(state);

    render();

    dispatch(
      'nexus:community-post-created',
      {
        post
      }
    );

    return {
      success: true,
      post
    };
  }

  function toggleLike(
    postId
  ) {
    const state =
      ensureSeedContent();

    const post =
      findPost(
        postId,
        state
      );

    if (!post) {
      return {
        success: false,
        message:
          'Post could not be found.'
      };
    }

    const alreadyLiked =
      Boolean(post.liked);

    post.liked =
      !alreadyLiked;

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

    saveState(state);

    render();

    return {
      success: true,
      liked:
        post.liked,
      likes:
        post.likes
    };
  }

  function addComment(
    postId,
    text
  ) {
    const state =
      ensureSeedContent();

    if (
      !state.loggedIn
    ) {
      return {
        success: false,
        message:
          'Sign in to comment.'
      };
    }

    const post =
      findPost(
        postId,
        state
      );

    if (!post) {
      return {
        success: false,
        message:
          'Post could not be found.'
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
          'Write a comment first.'
      };
    }

    if (
      cleanText.length >
      500
    ) {
      return {
        success: false,
        message:
          'Keep comments under 500 characters.'
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

    post.comments.push({
      id:
        createId('COMMENT'),

      author:
        getCurrentUserName(),

      text:
        cleanText,

      timestamp:
        Date.now()
    });

    post.comments =
      post.comments.slice(
        -50
      );

    saveState(state);

    render();

    dispatch(
      'nexus:community-comment-created',
      {
        postId,
        comment:
          post.comments[
            post.comments.length - 1
          ]
      }
    );

    return {
      success: true
    };
  }

  function deletePost(
    postId
  ) {
    const state =
      ensureSeedContent();

    const index =
      state.communityPosts.findIndex(
        (post) =>
          post.id ===
          postId
      );

    if (
      index === -1
    ) {
      return {
        success: false,
        message:
          'Post could not be found.'
      };
    }

    const post =
      state.communityPosts[
        index
      ];

    if (
      post.official
    ) {
      return {
        success: false,
        message:
          'Official posts cannot be removed.'
      };
    }

    const currentUser =
      getCurrentUserName();

    if (
      post.author !==
      currentUser
    ) {
      return {
        success: false,
        message:
          'You can only remove your own simulation posts.'
      };
    }

    state.communityPosts.splice(
      index,
      1
    );

    saveState(state);

    render();

    return {
      success: true
    };
  }

  function searchPosts(
    query
  ) {
    const state =
      ensureSeedContent();

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
      (post) =>
        String(
          post.author
        )
          .toLowerCase()
          .includes(
            cleanQuery
          ) ||
        String(
          post.text
        )
          .toLowerCase()
          .includes(
            cleanQuery
          )
    );
  }

  function renderPosts(
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
        'No community posts found.';

      container.appendChild(
        empty
      );

      return;
    }

    posts.forEach(
      (post) => {
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
          escapeText(
            post.avatar ||
              getInitials(
                post.author
              )
          );

        const authorBlock =
          document.createElement(
            'div'
          );

        authorBlock.className =
          'community-author';

        const author =
          document.createElement(
            'strong'
          );

        author.textContent =
          escapeText(
            post.author
          );

        const meta =
          document.createElement(
            'span'
          );

        meta.textContent =
          `${post.role || 'Member'} · ${timeAgo(
            post.timestamp
          )}`;

        authorBlock.append(
          author,
          meta
        );

        header.append(
          avatar,
          authorBlock
        );

        if (
          post.official
        ) {
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

        const paragraph =
          document.createElement(
            'p'
          );

        paragraph.textContent =
          escapeText(
            post.text
          );

        body.appendChild(
          paragraph
        );

        const footer =
          document.createElement(
            'div'
          );

        footer.className =
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
            Boolean(post.liked)
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

        footer.append(
          likeButton,
          commentButton
        );

        const commentBox =
          document.createElement(
            'div'
          );

        commentBox.className =
          'community-comment-box hidden';

        commentBox.dataset.commentBox =
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
              const commentRow =
                document.createElement(
                  'div'
                );

              commentRow.className =
                'community-comment';

              const commentAuthor =
                document.createElement(
                  'strong'
                );

              commentAuthor.textContent =
                escapeText(
                  comment.author
                );

              const commentText =
                document.createElement(
                  'span'
                );

              commentText.textContent =
                escapeText(
                  comment.text
                );

              commentRow.append(
                commentAuthor,
                commentText
              );

              commentBox.appendChild(
                commentRow
              );
            }
          );

        const form =
          document.createElement(
            'form'
          );

        form.className =
          'community-comment-form';

        form.dataset.commentForm =
          post.id;

        const input =
          document.createElement(
            'input'
          );

        input.type =
          'text';

        input.placeholder =
          'Write a comment…';

        input.maxLength =
          500;

        input.autocomplete =
          'off';

        input.required =
          true;

        const send =
          document.createElement(
            'button'
          );

        send.type =
          'submit';

        send.textContent =
          'Send';

        form.append(
          input,
          send
        );

        commentBox.appendChild(
          form
        );

        article.append(
          header,
          body,
          footer,
          commentBox
        );

        container.appendChild(
          article
        );
      }
    );
  }

  function render() {
    const state =
      ensureSeedContent();

    const queryInput =
      document.querySelector(
        '[data-community-search]'
      );

    const query =
      queryInput
        ? queryInput.value
        : '';

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
          renderPosts(
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
        (node) => {
          node.textContent =
            getCurrentUserName();
        }
      );

    document
      .querySelectorAll(
        '[data-community-member-avatar]'
      )
      .forEach(
        (node) => {
          node.textContent =
            getInitials(
              getCurrentUserName()
            );
        }
      );

    updateCommunityCount(
      state.communityPosts.length
    );
  }

  function updateCommunityCount(
    count
  ) {
    document
      .querySelectorAll(
        '[data-community-count]'
      )
      .forEach(
        (node) => {
          node.textContent =
            String(count);
        }
      );
  }

  function showToast(
    message
  ) {
    const wrap =
      document.getElementById(
        'toastWrap'
      );

    if (!wrap) {
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

    wrap.appendChild(
      toast
    );

    window.setTimeout(
      () => {
        toast.remove();
      },
      3000
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

    if (
      result.success
    ) {
      if (input) {
        input.value =
          '';
      }

      showToast(
        'Post published to the simulation community.'
      );
    } else {
      showToast(
        result.message
      );
    }
  }

  function handleFeedClick(
    event
  ) {
    const likeButton =
      event.target.closest(
        '[data-community-like]'
      );

    if (
      likeButton
    ) {
      const result =
        toggleLike(
          likeButton.dataset.communityLike
        );

      if (
        !result.success
      ) {
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

    if (
      commentButton
    ) {
      const box =
        document.querySelector(
          `[data-comment-box="${CSS.escape(
            commentButton.dataset.communityComments
          )}"]`
        );

      if (box) {
        box.classList.toggle(
          'hidden'
        );

        if (
          !box.classList.contains(
            'hidden'
          )
        ) {
          const input =
            box.querySelector(
              'input'
            );

          window.setTimeout(
            () => input?.focus(),
            30
          );
        }
      }
    }
  }

  function handleCommentSubmit(
    event
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

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

    if (
      result.success
    ) {
      if (input) {
        input.value =
          '';
      }

      showToast(
        'Comment added.'
      );
    } else {
      showToast(
        result.message
      );
    }
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
            (event) => {
              if (
                event.target.matches(
                  '[data-comment-form]'
                )
              ) {
                handleCommentSubmit(
                  event
                );
              }
            }
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
      'nexus:auth-updated',
      render
    );

    window.addEventListener(
      'nexus:trade-completed',
      () => {
        addSystemTradingPost();
      }
    );
  }

  function addSystemTradingPost() {
    /*
     * Add only an educational/simulation
     * status message, never a fake claim
     * about real user earnings.
     */
    const state =
      ensureSeedContent();

    if (
      !state.activeTrade
    ) {
      return;
    }

    const active =
      state.activeTrade;

    const post = {
      id:
        createId('POST-SYSTEM'),

      author:
        'NEXUS Simulator',

      role:
        'Simulation',

      avatar:
        'N',

      text:
        `${active.planName} simulation cycle reached its configured completion state. Review the simulated result from Trade History.`,

      timestamp:
        Date.now(),

      likes:
        0,

      liked:
        false,

      comments:
        [],

      official:
        true
    };

    state.communityPosts.unshift(
      post
    );

    state.communityPosts =
      state.communityPosts.slice(
        0,
        100
      );

    saveState(state);

    render();
  }

  function init() {
    ensureSeedContent();
    bindEvents();
    render();
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
            detail
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

  window.NexusCommunity =
    Object.freeze({
      loadState,
      saveState,
      createPost,
      toggleLike,
      addComment,
      deletePost,
      searchPosts,
      render
    });

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
