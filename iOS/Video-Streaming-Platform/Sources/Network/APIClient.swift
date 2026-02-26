//
//  APIClient.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/25/26.
//

import Foundation

final class APIClient {

    let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func makeRequest(for endpoint: Endpoint) throws -> URLRequest {
        var url = baseURL.appending(path: endpoint.path)

        if let queryItems = endpoint.queryItems {
            url.append(queryItems: queryItems)
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue

        if let body = endpoint.body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return request
    }
}
