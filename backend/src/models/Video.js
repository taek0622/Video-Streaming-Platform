module.exports = (sequelize, DataTypes) => {
    const Video = sequelize.define(
        "Video",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING(200),
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: "Title cannot be empty",
                    },
                    len: {
                        args: [1, 200],
                        msg: "Title must be between 1 and 200 characters",
                    },
                },
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            videoType: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "vod",
                field: "video_type",
                validate: {
                    isIn: {
                        args: [["vod", "live"]],
                        msg: 'Video type must be either "vod" or "live"',
                    },
                },
            },
            // 라이브 스트리밍용 필드
            streamKey: {
                type: DataTypes.STRING(100),
                unique: true,
                allowNull: true,
                field: "stream_key",
            },
            isLive: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: "is_live",
            },
            saveAsVod: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: "save_as_vod",
                comment: "라이브 종료 후 VOD로 저장할지 여부",
            },
            // VOD용 필드 - 원본 파일
            videoUrl: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: "video_url",
            },
            // VOD용 필드 - HLS 플레이리스트
            hlsUrl: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: "hls_url",
            },
            // HLS 처리 상태
            hlsStatus: {
                type: DataTypes.STRING(20),
                defaultValue: "pending", // pending, processing, completed, failed
                field: "hls_status",
            },
            duration: {
                type: DataTypes.INTEGER, // 초 단위
                allowNull: true,
                validate: {
                    min: 0,
                },
            },
            // 영상 해상도
            width: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            height: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            // 공통 필드
            uploaderId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "uploader_id",
                references: {
                    model: "users",
                    key: "id",
                },
            },
            thumbnailUrl: {
                type: DataTypes.STRING(255),
                field: "thumbnail_url",
            },
            views: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                validate: {
                    min: 0,
                },
            },
        },
        {
            tableName: "videos",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            indexes: [
                { fields: ["uploader_id"] },
                { fields: ["video_type"] },
                { fields: ["is_live"] },
                { fields: ["created_at"] },
                { fields: ["title"] }, // 검색용
                { fields: ["hls_status"] },
            ],
        }
    );

    // 관계 설정
    Video.associate = (models) => {
        // Video:User = N:1
        Video.belongsTo(models.User, {
            foreignKey: "uploaderId",
            as: "uploader",
        });

        // Video:Comment = 1:N
        Video.hasMany(models.Comment, {
            foreignKey: "videoId",
            as: "comments",
            onDelete: "CASCADE",
        });
    };

    // 인스턴스 메서드: 조회수 증가
    Video.prototype.incrementViews = async function () {
        this.views += 1;
        await this.save();
        return this.views;
    };

    return Video;
};
