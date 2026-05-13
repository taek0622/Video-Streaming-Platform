//
//  SignInManager.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/25/26.
//

import Foundation

final class DevSignInManager: SignInService {

    private let apiClient = APIClient(baseURL: APIEnvironment.dev.baseURL)

    func signIn(with credential: SignInCredential) async throws -> AuthResult {
        let endpoint = Endpoint.authDev(request: AuthDevRequest(nickname: "TestUser1"))
        var result = AuthResult(token: "", user: User(id: "", nickname: ""))

        do {
            let request = try apiClient.makeRequest(for: endpoint)
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoded = try JSONDecoder().decode(AuthResult.self, from: data)
            result = decoded
        } catch {
            print("Error: \(error.localizedDescription)")
        }

        return result
    }

}
