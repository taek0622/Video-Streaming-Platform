//
//  SearchViewModel.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/22/26.
//

import Foundation

@MainActor
final class SearchViewModel: ObservableObject {

    @Published var videos: [Video] = []
    @Published var page = 1
    @Published private(set) var hasNext = false
    @Published var isLoading = false

    private var searchingToken = UUID()

    private let videoService: VideoService

    init(service: VideoService) {
        self.videoService = service
    }

    func searchVideo(keyword: String, sortType: SortType) async {
        if isLoading {
            return
        }

        if page != 1 && !hasNext {
            return
        }

        if page == 1 {
            searchingToken = .init()
        }

        let sessionToken = searchingToken

        isLoading = true
        defer { isLoading = false }

        let res = await videoService.fetchSearchedVideo(keyword: keyword, sortType: sortType, page: page)

        if searchingToken != sessionToken {
            return
        }

        videos.append(contentsOf: res.items)
        hasNext = res.hasNext
        page += 1
    }

    func resetSearchResult() {
        videos = []
        page = 1
    }

}

