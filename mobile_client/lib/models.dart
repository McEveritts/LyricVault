class Song {
  final int id;
  final String title;
  final String artist;
  final String status;
  final String lyricsStatus;
  final bool lyricsSynced;
  final String streamUrl;
  final String? sourceUrl;
  final String? coverUrl;
  final int? duration;

  Song({
    required this.id,
    required this.title,
    required this.artist,
    required this.status,
    required this.lyricsStatus,
    required this.lyricsSynced,
    required this.streamUrl,
    this.sourceUrl,
    this.coverUrl,
    this.duration,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    return Song(
      id: json['id'],
      title: json['title'],
      artist: json['artist'],
      status: json['status'],
      lyricsStatus: json['lyrics_status'],
      lyricsSynced: json['lyrics_synced'],
      streamUrl: json['stream_url'],
      sourceUrl: json['source_url'],
      coverUrl: json['cover_url'],
      duration: json['duration'],
    );
  }
}
