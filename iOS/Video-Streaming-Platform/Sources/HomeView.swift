//
//  HomeView.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 11/26/25.
//

import SwiftUI

struct HomeView: View {

    var body: some View {
        ScrollView {
            VideoCard()
            VideoCard()
            VideoCard()
            VideoCard()
            VideoCard()
            VideoCard()
        }
    }
}

struct VideoCard: View {

    var body: some View {
        VStack(alignment: .leading) {
            ZStack(alignment: .bottomTrailing) {
//                Image() // 썸네일
                Color.gray
                Text("3:31") // 시간
                    .foregroundStyle(Color.white)
                    .background(Color.black.opacity(0.7))
                    .padding(8)
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(16/9, contentMode: .fit)
            Text("영상의 제목입니다")
                .bold()
                .padding(.horizontal, 16)
            HStack {
                Text("영상업로더")
                Text("·")
                Text("2026.02.20")
            }
            .foregroundStyle(.gray)
            .padding(.horizontal, 16)
        }
    }
}

#Preview {
    HomeView()
}
