//
//  VideoManager.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/21/26.
//

import Foundation

final class VideoManager: VideoService {

    private let apiClient = APIClient(baseURL: APIEnvironment.dev.baseURL)

    func fetchHomeVideo() async -> [Video] {
        let endpoint = Endpoint.home
        var result = [Video]()

        do {
            let request = try apiClient.makeRequest(for: endpoint)
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoded = try JSONDecoder().decode([VideoDTO].self, from: data).map { $0.asVideo() }
            result = decoded
        } catch {
            print("Error: \(error.localizedDescription)")
        }

        return result
    }

    func fetchSearchedVideo(keyword: String, sortType: SortType, page: Int) async -> SearchedVideoList {
        let endpoint = Endpoint.search(keyword: keyword, sortType: sortType, page: page)
        var result = SearchedVideoList(hasNext: false, items: [])

        do {
            let request = try apiClient.makeRequest(for: endpoint)
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoded = try JSONDecoder().decode(SearchedVideoListDTO.self, from: data).asVideoList()
            result = decoded
        } catch {
            print("Error: \(error.localizedDescription)")
        }

        return result
    }

}
