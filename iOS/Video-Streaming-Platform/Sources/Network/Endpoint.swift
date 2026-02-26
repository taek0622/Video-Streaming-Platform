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

}
