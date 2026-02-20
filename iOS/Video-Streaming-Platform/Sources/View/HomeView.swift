        .onAppear {
            let videoma = VideoManager()
            Task {
                await videoma.fetchHomeVideo()
            }
