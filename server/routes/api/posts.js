const express = require("express");
const { check, validationResult } = require("express-validator");
const router = express.Router();

const auth = require("../../middleware/auth");
const upload = require("../../middleware/cloudinary");
const { Post, Comment, Like } = require("../../models/Post");
const User = require("../../models/User");
const { Profile } = require("../../models/Profile");

// @route:    POST api/posts
// @desc:     Create a post
// @access:   Private
router.post(
  "/",
  [
    auth,
    upload,
    [
      check("title", "Title is required").not().isEmpty(),
      check("techTags", "Atleast 1 tag is required").not().isEmpty(),
      check("websiteUrl", "Enter a valid URL").isURL(),
      check("websiteUrl", "Website URL is required").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if(req.fileValidationError) errors.errors.push({msg:req.fileValidationError});
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Create post object
      const { title, description, techTags, websiteUrl, repoUrl } = req.body;

      const newPost = {};
      newPost.userId = req.user.id;
      if (title) newPost.title = title;
      if (description) newPost.description = description;
      if (websiteUrl) newPost.websiteUrl = websiteUrl;
      if (repoUrl) newPost.repoUrl = repoUrl;

      // Get only links from the file object
      if (req.files) {
        newPost.images = req.files.map((image) => image.path);
      }

      // Split comma seperated tags into individual tags
      if (techTags) {
        newPost.techTags = techTags.split(",").map((tag) => tag.trim());
      }

      const post = await Post.create(newPost);
      const postWithUser = await Post.findByPk(post.id, {
        include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }]
      });
      res.json(postWithUser);
    } catch (err) {
      console.error(err.message);
      res
        .status(500)
        .send("There was an issue with the server. Try again later.");
    }
  }
);

// @route:    GET api/posts
// @desc:     Get all posts
// @access:   Private
router.get("/", auth, async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }],
      order: [['date', 'DESC']]
    });
    res.json(posts);
  } catch (err) {
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    GET api/posts/feed
// @desc:     Get posts of following users
// @access:   Private
router.get("/feed", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ 
      where: { userId: req.user.id },
      include: [{ model: Profile, as: 'following' }]
    });

    if (!profile || !profile.following || profile.following.length === 0) {
      return res.json([]);
    }

    // Create an array of user ids of following
    const followingUserIds = profile.following.map((following) => following.id);

    // Get posts of following users
    const posts = await Post.findAll({
      where: { userId: followingUserIds },
      include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }],
      order: [['date', 'DESC']]
    });

    res.json(posts);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    GET api/posts/:post_id
// @desc:     Get post by ID
// @access:   Private
router.get("/:post_id", auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.post_id, {
      include: [
        { model: User, as: 'user', attributes: ['name', 'avatar'] },
        { model: Comment, as: 'comments' },
        { model: User, as: 'likes', attributes: ['name', 'avatar'] }
      ]
    });

    // If there's no such post
    if (!post) {
      return res.status(404).json({ msg: "Post not found" });
    }

    res.json(post);
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    GET api/posts/user/:user_id
// @desc:     Get all posts by an user
// @access:   Private
router.get("/user/:user_id", auth, async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { userId: req.params.user_id },
      include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }]
    });
    
    if (!posts || posts.length === 0) {
      return res.status(400).json({ msg: "No posts found" });
    }
    res.json(posts);
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    DELETE api/posts/:post_id
// @desc:     Delete post by ID
// @access:   Private
router.delete("/:post_id", auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.post_id);

    // If there's no such post
    if (!post) {
      return res.status(404).json({ msg: "Post not found" });
    }

    // Check ownership of post
    if (post.userId !== req.user.id) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    await post.destroy();
    res.json({ msg: "Post deleted" });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    PUT api/posts/like/:id
// @desc:     Like a post
// @access:   Private
router.put("/like/:id", auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ msg: "Post not found" });
    }

    // Check if post is already liked
    const existingLike = await Like.findOne({
      where: { postId: req.params.id, userId: req.user.id }
    });

    if (existingLike) {
      return res.status(400).json({ msg: "Post already liked" });
    }

    // Add like
    await Like.create({
      postId: req.params.id,
      userId: req.user.id
    });

    const updatedPost = await Post.findByPk(req.params.id, {
      include: [{ model: User, as: 'likes', attributes: ['name', 'avatar'] }]
    });

    res.json(updatedPost.likes);
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    PUT api/posts/unlike/:id
// @desc:     Unlike a post
// @access:   Private
router.put("/unlike/:id", auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    // Check if post exists
    if (!post) {
      return res.status(404).json({ msg: "Post not found" });
    }

    // Check if post has been liked
    const existingLike = await Like.findOne({
      where: { postId: req.params.id, userId: req.user.id }
    });

    if (!existingLike) {
      return res.status(400).json({ msg: "Post has not been liked yet" });
    }

    // Remove like
    await existingLike.destroy();

    const updatedPost = await Post.findByPk(req.params.id, {
      include: [{ model: User, as: 'likes', attributes: ['name', 'avatar'] }]
    });

    res.json(updatedPost.likes);
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .send("There was an issue with the server. Try again later.");
  }
});

// @route:    POST api/post/comment/:post_id
// @desc:     Post a comment
// @access:   Private
router.post(
  "/comment/:post_id",
  [auth, [check("text", "Comment text is required").not().isEmpty()]],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const post = await Post.findByPk(req.params.post_id);
      const user = await User.findByPk(req.user.id);

      if (!post) {
        return res.status(404).json({ msg: "Post not found" });
      }

      const newComment = await Comment.create({
        postId: req.params.post_id,
        name: user.name,
        avatar: user.avatar,
        text: req.body.text,
        userId: req.user.id,
      });

      const comments = await Comment.findAll({
        where: { postId: req.params.post_id }
      });

      res.json(comments);
    } catch (err) {
      console.error(err.message);
      res
        .status(500)
        .send("There was an issue with the server. Try again later.");
    }
  }
);

// @route:    DELETE api/post/comment/:post_id/:comment_id
// @desc:     Delete a comment
// @access:   Private
router.delete("/comment/:id/:comment_id", auth, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.comment_id);

    // Check if comment exists
    if (!comment) {
      return res.status(404).json({ msg: "Comment does not exist" });
    }

    // Check if comment is posted by the same user
    if (comment.userId !== req.user.id) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    // Remove comment
    await comment.destroy();

    const comments = await Comment.findAll({
      where: { postId: req.params.id }
    });

    res.json(comments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
