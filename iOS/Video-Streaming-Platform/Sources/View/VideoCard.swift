//
//  VideoCard.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/21/26.
//

import SwiftUI

struct VideoCard: View {

    let video: Video

    var body: some View {
        VStack(alignment: .leading) {
            ZStack(alignment: .bottomTrailing) {
                AsyncImage(url: video.thumbnailUrl) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Color.gray
                }
                Text(video.getDurationString())
                    .foregroundStyle(Color.white)
                    .padding(4)
                    .background(Color.black.opacity(0.7))
                    .padding(8)
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(16/9, contentMode: .fit)
            Text(video.title)
                .bold()
                .padding(.horizontal, 16)
            HStack {
                Text(video.uploader.nickname)
                Text("·")
                Text(video.createdAt, style: .date)
            }
            .foregroundStyle(.gray)
            .padding(.horizontal, 16)
        }
    }
}
