//
//  VideoService.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/20/26.
//

import Foundation

protocol VideoService {
    func fetchHomeVideo() async -> [Video]
}
