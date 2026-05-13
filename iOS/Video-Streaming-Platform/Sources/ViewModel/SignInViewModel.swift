//
//  SignInViewModel.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/26/26.
//

import Foundation

final class SignInViewModel: ObservableObject {

    private let signInService: SignInService

    init(service: SignInService) {
        signInService = service
    }

    func signIn(nickname: String) async -> AuthResult {
        var result = AuthResult(token: "", user: User(id: "", nickname: ""))

        do {
            result = try await signInService.signIn(with: SignInCredential.dev(nickname: nickname))
        } catch {
            print("Error: \(error.localizedDescription)")
        }

        return result
    }

}
