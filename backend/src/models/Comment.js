module.exports = (sequelize, DataTypes) => {
    const Comment = sequelize.define(
        "Comment",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            videoId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                field: "video_id",
                references: {
                    model: "videos",
                    key: "id",
                },
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "user_id",
                references: {
                    model: "users",
                    key: "id",
                },
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: "Comment content cannot be empty",
                    },
                    len: {
                        args: [1, 1000],
                        msg: "Comment must be between 1 and 1000 characters",
                    },
                },
            },
        },
        {
            tableName: "comments",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { fields: ["video_id"] },
                { fields: ["user_id"] },
                { fields: ["created_at"] },
            ],
        }
    );

    // 관계 설정
    Comment.associate = (models) => {
        // Comment:User = N:1
        Comment.belongsTo(models.User, {
            foreignKey: "userId",
            as: "author",
        });

        // Comment:Video = N:1
        Comment.belongsTo(models.Video, {
            foreignKey: "videoId",
            as: "video",
        });
    };

    return Comment;
};
