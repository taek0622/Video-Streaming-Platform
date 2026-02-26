//
//  AnyEncodable.swift
//  Video-Streaming-Platform
//
//  Created by 김민택 on 2/25/26.
//

import Foundation

struct AnyEncodable: Encodable {
    private let encodable: Encodable

    init(_ encodable: Encodable) {
        self.encodable = encodable
    }

    func encode(to encoder: any Encoder) throws {
        try encodable.encode(to: encoder)
    }
}
