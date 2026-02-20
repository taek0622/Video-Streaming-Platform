//
//  HomeView.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 11/26/25.
//

import SwiftUI

struct HomeView: View {

    @StateObject private var viewModel = HomeViewModel(service: VideoManager())

    var body: some View {
        List(viewModel.videos) { video in
            VideoCard(video: video)
                .listRowInsets(.init(top: .zero, leading: .zero, bottom: 8, trailing: .zero))
        }
        .listStyle(.plain)
        .task {
            await viewModel.loadVideos()
        }
    }
}

#Preview {
    HomeView()
}
