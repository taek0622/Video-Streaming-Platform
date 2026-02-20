import SwiftUI

public struct ContentView: View {
    public init() {}

    public var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                HomeView()
            }
        }
    }
}


struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
