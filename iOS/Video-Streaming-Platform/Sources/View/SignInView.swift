//
//  SignInView.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/26/26.
//

import SwiftUI

struct SignInView: View {

    @StateObject private var viewModel: SignInViewModel
    @EnvironmentObject var authManager: AuthManager

    @State private var nickname = ""
    @State private var isLoading = false

    init(service: SignInService) {
        _viewModel = StateObject(wrappedValue: SignInViewModel(service: service))
    }

    var body: some View {
        if authManager.isSignedIn {
            
        } else {
            VStack {
                TextField("사용할 닉네임을 2~10 자리로 입력해주세요", text: $nickname)
                Button {
                    isLoading = true
                    Task {
                        defer { isLoading = false }
                        let signInResult = await viewModel.signIn(nickname: nickname) // jwt token 및 유저 정보 반환. AuthManager에 임시 저장해야함
                        authManager.setSession(accessToken: signInResult.token)
                    }
                } label: {
                    Text("로그인")
                }
                .disabled(isLoading || !(2...10 ~= nickname.count))
            }
        }
    }
}
