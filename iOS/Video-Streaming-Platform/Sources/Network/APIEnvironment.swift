//
//  APIEnvironment.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/26/26.
//

import Foundation

enum APIEnvironment {
    case local
    case dev

    var baseURL: URL {
        switch self {
            case .local:
                return URL(string: "http://localhost:3000")!
            case .dev:
                return URL(string: "http://192.168.0.23:3000")!
        }
    }
}
