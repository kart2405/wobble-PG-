const express = require('express')
const { check, validationResult } = require('express-validator')
const router = express.Router()
const auth = require('../../middleware/auth')
const User = require('../../models/User')
const { Profile, Followers, Following } = require('../../models/Profile')
const axios = require('axios')
const config = require('config')

// @route:    POST api/profile
// @desc:     Create or update user profile
// @access:   Private
router.post(
  '/',
  [
    auth,
    [
      check('bio', 'Bio is required').not().isEmpty(),
      check('skills', 'Skills is required').not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const {
      bio,
      website,
      location,
      skills,
      githubUsername,
      twitter,
      instagram,
      linkedin,
      codepen,
      github,
    } = req.body

    // Build profile object
    const profileFields = {}
    profileFields.userId = req.user.id
    if (bio) profileFields.bio = bio
    if (website) profileFields.website = website
    if (location) profileFields.location = location
    if (skills) {
      profileFields.skills = skills.split(',').map((skill) => skill.trim())
    }
    if (githubUsername) profileFields.githubUsername = githubUsername

    // Build social object
    profileFields.social = {}
    if (twitter) profileFields.social.twitter = twitter
    if (instagram) profileFields.social.instagram = instagram
    if (linkedin) profileFields.social.linkedin = linkedin
    if (codepen) profileFields.social.codepen = codepen
    if (github) profileFields.social.github = github

    try {
      let profile = await Profile.findOne({ where: { userId: req.user.id } })

      // If profile already exists, update it
      if (profile) {
        profile = await Profile.update(profileFields, {
          where: { userId: req.user.id },
          returning: true,
        })
        const updatedProfile = await Profile.findOne({
          where: { userId: req.user.id },
          include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }]
        })
        return res.json(updatedProfile)
      }

      // If profile doesn't exist, make a new one
      profile = await Profile.create(profileFields)
      const newProfile = await Profile.findByPk(profile.id, {
        include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }]
      })
      return res.json(newProfile)
    } catch (err) {
      console.error(err.message)
      res
        .status(500)
        .send('There was an issue with the server. Try again later.')
    }
  }
)

// @route:    GET api/profile/me
// @desc:     Get current user's profile
// @access:   Private
router.get('/me', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      where: { userId: req.user.id },
      include: [
        { model: User, as: 'user', attributes: ['name', 'avatar'] },
        { model: Profile, as: 'followers', include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }] },
        { model: Profile, as: 'following', include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }] }
      ]
    })

    // If there's no profile
    if (!profile) {
      return res.status(400).json({ msg: 'There is no profile for this user' })
    }

    return res.json(profile)
  } catch (err) {
    console.error(err.message)
    res.status(500).send('There was an issue with the server. Try again later.')
  }
})

// @route:    GET /api/profile
// @desc:     Get all profiles
// @access:   Public
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.findAll({
      include: [
        { model: User, as: 'user', attributes: ['name', 'avatar'] },
        { model: Profile, as: 'followers', include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }] },
        { model: Profile, as: 'following', include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }] }
      ]
    })
    res.json(profiles)
  } catch (err) {
    console.error(err.message)
    res.status(500).send('There was an issue with the server. Try again later.')
  }
})

// @route:    GET api/profile/user/:user_id
// @desc:     Get profile by user ID
// @access:   Public
router.get('/user/:user_id', async (req, res) => {
  try {
    const profile = await Profile.findOne({
      where: { userId: req.params.user_id },
      include: [
        { model: User, as: 'user', attributes: ['name', 'avatar'] },
        { model: Profile, as: 'followers', include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }] },
        { model: Profile, as: 'following', include: [{ model: User, as: 'user', attributes: ['name', 'avatar'] }] }
      ]
    })

    // If there's no profile
    if (!profile) {
      return res.status(400).json({ msg: 'Profile not found' })
    }

    return res.json(profile)
  } catch (err) {
    console.error(err.message)
    res.status(500).send('There was an issue with the server. Try again later.')
  }
})

// @route:    DELETE api/profile
// @desc:     Delete user and profile
// @access:   Private
router.delete('/', auth, async (req, res) => {
  try {
    await Profile.destroy({ where: { userId: req.user.id } })
    await User.destroy({ where: { id: req.user.id } })
    res.json({ msg: 'User deleted' })
  } catch (err) {
    console.error(err.message)
    res.status(500).send('There was an issue with the server. Try again later.')
  }
})

// @route:    GET api/profile/github/:username
// @desc:     Get latest GitHub repos
// @access:   Public
router.get('/github/:username', async (req, res) => {
  try {
    const redisClient = await require('../../config/redis.js').getConnection()
    const redisKey = `github-${req.params.username}-profile`
    let cachedResponse = await redisClient.get(redisKey)
    if (cachedResponse) {
      console.log(`using cache: github api | username: ${req.params.username}`)
      cachedResponse = JSON.parse(cachedResponse)
      return res.json(cachedResponse)
    }

    const apiURI = encodeURI(
      `https://api.github.com/users/${req.params.username}/repos?per_page=5&sort=created:asc`
    )
    const response = await axios.get(apiURI, {
      'user-agent': 'node.js',
      Authorization: `token ${config.get('GITHUB_API_CLIENT_ID')}`,
    })

    await redisClient.set(redisKey, JSON.stringify(response.data), {
      EX: 3 * 60,
      NX: true,
    })
    console.log(`set cache: github api | username: ${req.params.username}`)

    return res.json(response.data)
  } catch (err) {
    console.error(err.message)
    res.status(400).json({ msg: 'No GitHub profile' })
  }
})

// @route:    PUT api/profile/follow/:user_id
// @desc:     Follow an user
// @access:   Private
router.put('/follow/:user_id', auth, async (req, res) => {
  try {
    // Check if user exists
    const profile = await Profile.findOne({ where: { userId: req.params.user_id } })
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' })
    }

    // Check if user is trying to follow himself/herself
    if (req.params.user_id === req.user.id.toString()) {
      return res.status(400).json({ msg: 'You cannot follow yourself' })
    }

    // Check if user is already following
    const existingFollow = await Following.findOne({
      where: { profileId: req.user.id, followingId: req.params.user_id }
    })

    if (existingFollow) {
      return res
        .status(400)
        .json({ msg: 'You are already following this user' })
    }

    // Otherwise, handle followers and following
    await Following.create({
      profileId: req.user.id,
      followingId: req.params.user_id
    })

    await Followers.create({
      profileId: req.params.user_id,
      followerId: req.user.id
    })

    res.json({ msg: 'User followed' })
  } catch (err) {
    console.error(err.message)
    res.status(500).send('There was an issue with the server. Try again later.')
  }
})

// @route:    PUT api/profile/unfollow/:user_id
// @desc:     Unfollow an user
// @access:   Private
router.put('/unfollow/:user_id', auth, async (req, res) => {
  try {
    // Check if user exists
    const profile = await Profile.findOne({ where: { userId: req.params.user_id } })
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' })
    }

    // Check if user is trying to unfollow himself/herself
    if (req.params.user_id === req.user.id.toString()) {
      return res.status(400).json({ msg: 'You cannot unfollow yourself' })
    }

    // Check if user is already following
    const existingFollow = await Following.findOne({
      where: { profileId: req.user.id, followingId: req.params.user_id }
    })

    if (!existingFollow) {
      return res
        .status(400)
        .json({ msg: 'You are not following this user' })
    }

    // Remove the follow relationship
    await Following.destroy({
      where: { profileId: req.user.id, followingId: req.params.user_id }
    })

    await Followers.destroy({
      where: { profileId: req.params.user_id, followerId: req.user.id }
    })

    res.json({ msg: 'User unfollowed' })
  } catch (err) {
    console.error(err.message)
    res.status(500).send('There was an issue with the server. Try again later.')
  }
})

module.exports = router
