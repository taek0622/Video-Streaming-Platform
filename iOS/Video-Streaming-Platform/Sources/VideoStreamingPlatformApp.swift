import SwiftUI

@main
struct VideoStreamingPlatformApp: App {
    @StateObject var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
        }
    }
}
