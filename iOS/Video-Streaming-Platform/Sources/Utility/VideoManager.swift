//
//  VideoManager.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/21/26.
//

import Foundation

final class VideoManager: VideoService {

    let baseURL = URL(string: "http://localhost:3000")!

    func fetchHomeVideo() async -> [Video] {
        let url = baseURL.appending(path: "home")
        let request = URLRequest(url: url)
        var result = [Video]()

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoded = try JSONDecoder().decode([VideoDTO].self, from: data).map { $0.asVideo() }
            result = decoded
        } catch {
            print("Error: \(error.localizedDescription)")
        }

        return result
    }

    func fetchSearchedVideo(keyword: String, sortType: SortType, page: Int) async -> SearchedVideoList {
        var url = baseURL.appending(path: "search")
        url.append(queryItems: [
            URLQueryItem(name: "keyword", value: keyword),
            URLQueryItem(name: "sort", value: sortType.rawValue), // popular: 인기순, latest: 최신순
            URLQueryItem(name: "page", value: String(page)), // 기본 1
            URLQueryItem(name: "size", value: "20") // 기본 10, 최대 50
        ])
        let request = URLRequest(url: url)
        var result = SearchedVideoList(hasNext: false, items: [])

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoded = try JSONDecoder().decode(SearchedVideoListDTO.self, from: data).asVideoList()
            result = decoded
        } catch {
            print("Error: \(error.localizedDescription)")
        }

        return result
    }

}
