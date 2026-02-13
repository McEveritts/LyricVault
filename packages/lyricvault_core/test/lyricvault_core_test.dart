import 'package:flutter_test/flutter_test.dart';

import 'package:lyricvault_core/lyricvault_core.dart';

void main() {
  test('Song.fromJson maps backend keys', () {
    final song = Song.fromJson({
      'id': 1,
      'title': 'Song Title',
      'artist': 'Artist',
      'status': 'cached',
      'lyrics_status': 'ready',
      'lyrics_synced': true,
      'stream_url': 'http://127.0.0.1:8000/stream/example.mp3',
      'source_url': 'https://example.com',
      'cover_url': 'https://example.com/cover.jpg',
      'duration': 123,
    });

    expect(song.id, 1);
    expect(song.title, 'Song Title');
    expect(song.artist, 'Artist');
    expect(song.lyricsStatus, 'ready');
    expect(song.lyricsSynced, true);
    expect(song.streamUrl, contains('/stream/'));
    expect(song.duration, 123);
  });
}
