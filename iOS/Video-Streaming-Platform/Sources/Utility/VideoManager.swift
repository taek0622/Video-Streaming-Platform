//
//  VideoManager.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/21/26.
//

import Foundation

final class VideoManager: VideoService {

    func fetchHomeVideo() async -> [Video] {
        let request = URLRequest(url: URL(string: "http://localhost:3000/home") ?? URL(string: "abount:blank")!)
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

}
