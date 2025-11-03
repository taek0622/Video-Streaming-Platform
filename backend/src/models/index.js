const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");

// import Model
const User = require("./User");
const Video = require("./Video");
const Comment = require("./Comment");

// 모델 초기화
const models = {
    User: User(sequelize, Sequelize.DataTypes),
    Video: Video(sequelize, Sequelize.DataTypes),
    Comment: Comment(sequelize, Sequelize.DataTypes),
};

// 관계 설정
Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

// sequelize 인스턴스 추가
models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
