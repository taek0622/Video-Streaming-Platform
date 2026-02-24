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

    private var page = 1
    private var hasNext = false
    private var isLoading = false
    private var searchingKeyword = ""
    private var searchingSortType = SortType.popular
    private var searchingToken = UUID()

    private let videoService: VideoService

    init(service: VideoService) {
        self.videoService = service
    }

    func startNewSearch(keyword: String, sortType: SortType) async {
        page = 1
        videos = []
        hasNext = false

        if keyword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return
        }

        searchingKeyword = keyword
        searchingSortType = sortType
        searchingToken = .init()
        let sessionToken = searchingToken

        isLoading = true
        defer { isLoading = false }

        let res = await videoService.fetchSearchedVideo(keyword: keyword, sortType: sortType, page: 1)

        if searchingToken != sessionToken {
            return
        }

        videos = res.items
        hasNext = res.hasNext
        page += 1
    }

    func loadNextPage() async {
        if isLoading || !hasNext {
            return
        }

        let sessionToken = searchingToken

        isLoading = true
        defer { isLoading = false }

        let res = await videoService.fetchSearchedVideo(keyword: searchingKeyword, sortType: searchingSortType, page: page)

        if searchingToken != sessionToken {
            return
        }

        videos.append(contentsOf: res.items)
        hasNext = res.hasNext
        page += 1
    }

}
