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

  const Song({
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
      id: json['id'] as int,
      title: json['title'] as String? ?? '',
      artist: json['artist'] as String? ?? '',
      status: json['status'] as String? ?? '',
      lyricsStatus: json['lyrics_status'] as String? ?? '',
      lyricsSynced: json['lyrics_synced'] as bool? ?? false,
      streamUrl: json['stream_url'] as String? ?? '',
      sourceUrl: json['source_url'] as String?,
      coverUrl: json['cover_url'] as String?,
      duration: json['duration'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'artist': artist,
      'status': status,
      'lyrics_status': lyricsStatus,
      'lyrics_synced': lyricsSynced,
      'stream_url': streamUrl,
      'source_url': sourceUrl,
      'cover_url': coverUrl,
      'duration': duration,
    };
  }
}

