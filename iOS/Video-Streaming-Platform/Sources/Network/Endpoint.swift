//
//  Endpoint.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/25/26.
//

import Foundation

enum Endpoint {
    case home
    case search(keyword: String, sortType: SortType, page: Int)
    case authDev(request: AuthDevRequest)

    var path: String {
        switch self {
            case .home:
                return "home"
            case .search:
                return "search"
            case .authDev:
                return "auth/dev"
        }
    }

    var method: HttpMethod {
        switch self {
            case .home, .search:
                return .get
            case .authDev:
                return .post
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
            case .search(let keyword, let sortType, let page):
                return [
                    URLQueryItem(name: "keyword", value: keyword),
                    URLQueryItem(name: "sort", value: sortType.rawValue),
                    URLQueryItem(name: "page", value: String(page)),
                    URLQueryItem(name: "size", value: "20")
                ]
            default:
                return nil
        }
    }

    var body: Encodable? {
        switch self {
            case .authDev(let request):
                return request
            default:
                return nil
        }
    }
}
