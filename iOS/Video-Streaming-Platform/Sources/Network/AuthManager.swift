//
//  AuthManager.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/26/26.
//

import Foundation

final class AuthManager: ObservableObject {

    @Published private(set) var accessToken: String? = nil

    var isSignedIn: Bool {
        accessToken != nil
    }

    func setSession(accessToken: String) {
        self.accessToken = accessToken
    }

    func logout() {
        self.accessToken = nil
    }

}
