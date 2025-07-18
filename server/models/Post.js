const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  },
  techTags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  },
  websiteUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  repoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'date',
  updatedAt: false
});

// Comment model
const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
      name: {
    type: DataTypes.STRING,
    allowNull: false
      },
      userId: {
    type: DataTypes.STRING,
    allowNull: false
      },
      avatar: {
    type: DataTypes.STRING,
    allowNull: false
      },
      text: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  timestamps: true,
  createdAt: 'date',
  updatedAt: false
});

// Like model
const Like = sequelize.define('Like', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  }
}, { timestamps: false });

// Define associations
Post.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Post, { foreignKey: 'userId', as: 'posts' });

Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'postId' });

Post.belongsToMany(User, { 
  through: Like, 
  as: 'likes', 
  foreignKey: 'postId',
  otherKey: 'userId'
});

User.belongsToMany(Post, { 
  through: Like, 
  as: 'likedPosts', 
  foreignKey: 'userId',
  otherKey: 'postId'
});

module.exports = { Post, Comment, Like };
