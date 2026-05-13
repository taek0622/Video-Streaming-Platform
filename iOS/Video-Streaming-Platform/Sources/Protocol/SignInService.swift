//
//  SignInService.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/25/26.
//

import Foundation

protocol SignInService {
    func signIn(with credential: SignInCredential) async throws -> AuthResult
}
