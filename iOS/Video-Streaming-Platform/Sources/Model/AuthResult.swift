//
//  AuthResult.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/25/26.
//

import Foundation

struct AuthResult: Codable {
    let token: String
    let user: User
}

struct User: Codable {
    let id: String
    let nickname: String
}
