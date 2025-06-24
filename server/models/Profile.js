const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  skills: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  },
  githubUsername: {
    type: DataTypes.STRING,
    allowNull: true
  },
  social: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  }
}, {
  timestamps: true,
  createdAt: 'date',
  updatedAt: false
});

// Define associations
Profile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Profile, { foreignKey: 'userId', as: 'profile' });

// Create junction tables for followers/following
const Followers = sequelize.define('Followers', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  }
}, { timestamps: false });

const Following = sequelize.define('Following', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  }
}, { timestamps: false });

// Many-to-many relationships for followers/following
Profile.belongsToMany(Profile, { 
  through: Followers, 
  as: 'followers', 
  foreignKey: 'profileId',
  otherKey: 'followerId'
});

Profile.belongsToMany(Profile, { 
  through: Following, 
  as: 'following', 
  foreignKey: 'profileId',
  otherKey: 'followingId'
});

module.exports = { Profile, Followers, Following };
