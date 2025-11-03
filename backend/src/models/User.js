const { sequelize } = require(".");

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define(
        "User",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            username: {
                type: DataTypes.STRING(16),
                allowNull: false,
                unique: {
                    msg: "Username already exists",
                },
                validate: {
                    len: {
                        args: [3, 16],
                        msg: "Username must be between 3 and 16 characters",
                    },
                },
            },
            email: {
                type: DataTypes.STRING(320),
                unique: {
                    msg: "Email already exists",
                },
                validate: {
                    isEmail: {
                        msg: "Must be a valid email address",
                    },
                },
            },
            passwordHash: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: "password_hash",
            },
            googleId: {
                type: DataTypes.STRING(255),
                unique: true,
                allowNull: true,
                field: "google_id",
            },
            appleId: {
                type: DataTypes.STRING(255),
                unique: true,
                allowNull: true,
                field: "apple_id",
            },
            fullName: {
                type: DataTypes.STRING(100),
                field: "full_name",
            },
            profileImage: {
                type: DataTypes.STRING(255),
                field: "profile_image",
            },
            lastLoginProvider: {
                type: DataTypes.STRING(20),
                field: "last_login_provider",
                validate: {
                    isIn: {
                        args: [["google", "apple", "password"]],
                        msg: "Invalid login provider",
                    },
                },
            },
        },
        {
            tableName: "users",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { fields: ["username"] },
                { fields: ["email"] },
                { fields: ["google_id"] },
                { fields: ["apple_id"] },
            ],
        }
    );

    // 관계 설정
    User.associate = (models) => {
        // User:Video = 1:N
        User.hasMany(models.Video, {
            foreignKey: "uploaderId",
            as: "videos",
            onDelete: "CASCADE",
        });

        // User:Comment = 1:N
        User.hasMany(models.Comment, {
            foreignKey: "userId",
            as: "comments",
            onDelete: "CASCADE",
        });
    };

    // 인스턴스 메서드: 안전한 사용자 정보 반환 (비밀번호 제외)
    User.prototype.toSafeObject = function () {
        const { id, username, email, fullName, profileImage, created_at } =
            this;
        return {
            id,
            username,
            email,
            fullName,
            profileImage,
            createdAt: created_at,
        };
    };

    return User;
};
