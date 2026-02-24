import SwiftUI

public struct ContentView: View {

    private let videoService: VideoService = VideoManager()

    public var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                HomeView(videoService: videoService)
            }

            Tab(role: .search) {
                NavigationStack {
                    SearchView(videoService: videoService)
                }
            }
        }
    }
}


struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
