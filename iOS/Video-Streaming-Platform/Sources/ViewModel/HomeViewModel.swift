//
//  HomeViewModel.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/20/26.
//

import Foundation

@MainActor
class HomeViewModel: ObservableObject {

    @Published var videos = [Video]()

    private let videoService: VideoService

    init(service: VideoService) {
        self.videoService = service
    }

    func loadVideos() async {
        videos = await videoService.fetchHomeVideo()
    }

}
