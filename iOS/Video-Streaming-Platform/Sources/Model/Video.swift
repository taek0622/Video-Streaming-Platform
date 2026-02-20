//
//  Video.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/20/26.
//

import Foundation

struct VideoDTO: Codable {
    let id: String
    let title: String
    let description: String?
    let durationSeconds: Int
    let uploader: Uploader
    let createdAt: String
    let playbackUrl: String
    let thumbnailUrl: String
    let score: Int
    let viewCount: Int
    let likeCount: Int
}

struct Uploader: Identifiable, Codable {
    let id: String
    let nickname: String
}

struct Video: Identifiable {
    let id: String
    let title: String
    let description: String
    let durationSeconds: Int
    let uploader: Uploader
    let createdAt: Date
    let playbackUrl: URL
    let thumbnailUrl: URL
    let score: Int
    let viewCount: Int
    let likeCount: Int
}

extension VideoDTO {
    func asVideo() -> Video {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX"
        dateFormatter.timeZone = TimeZone(identifier: "KST")
        let date: Date = dateFormatter.date(from: self.createdAt)!

        return Video(id: self.id, title: self.title, description: self.description ?? "" , durationSeconds: self.durationSeconds, uploader: self.uploader, createdAt: date, playbackUrl: URL(string: self.playbackUrl)!, thumbnailUrl: URL(string: self.thumbnailUrl)!, score: self.score, viewCount: self.viewCount, likeCount: self.likeCount)
    }
}

extension Video {
    func getDurationString() -> String {
        var duration = self.durationSeconds
        let day = duration / (60 * 60 * 24)
        duration %= (60 * 60 * 24)
        let hour = duration / (60 * 60)
        duration %= (60 * 60)
        let min = duration / 60
        duration %= 60

        return (day != 0 ? String(format: "%02d", day) + ":" : "") + (day != 0 || hour != 0 ? String(format: "%02d", hour) + ":" : "") + String(format: "%02d", min) + ":" + String(format: "%02d", duration)
    }
}
