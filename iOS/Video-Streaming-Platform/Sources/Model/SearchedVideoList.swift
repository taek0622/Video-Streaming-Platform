//
//  SearchedVideoList.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/24/26.
//

import Foundation

struct SearchedVideoListDTO: Codable {
    let page: Int
    let size: Int
    let totalCount: Int
    let totalPages: Int
    let hasNext: Bool
    let hasPrev: Bool
    let items: [VideoDTO]
}

struct SearchedVideoList {
    let hasNext: Bool
    let items: [Video]
}

extension SearchedVideoListDTO {
    func asVideoList() -> SearchedVideoList {
        let videos = self.items.map { $0.asVideo() }
        return SearchedVideoList(hasNext: self.hasNext, items: videos)
    }
}
