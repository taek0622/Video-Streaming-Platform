//
//  SearchView.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/22/26.
//

import SwiftUI

struct SearchView: View {

    @StateObject private var viewModel: SearchViewModel

    @State private var searchingText = ""

    init(videoService: VideoService = VideoManager()) {
        _viewModel = StateObject(wrappedValue: SearchViewModel(service: videoService))
    }

    var body: some View {
        List(viewModel.videos) { video in
            VideoCard(video: video)
                .listRowInsets(.init(top: .zero, leading: .zero, bottom: 8, trailing: .zero))
                .onAppear {
                    if (viewModel.videos.lastIndex { $0.id == video.id }) == viewModel.videos.count - 5 {
                        Task {
                            await viewModel.searchVideo(keyword: searchingText, sortType: .popular)
                        }
                    }
                }
        }
        .listStyle(.plain)
        .toolbarVisibility(.hidden, for: .navigationBar)
        .searchable(text: $searchingText)
        .onSubmit(of: .search, {
            viewModel.resetSearchResult()

            Task {
                await viewModel.searchVideo(keyword: searchingText, sortType: .popular)
            }
        })
    }
}

