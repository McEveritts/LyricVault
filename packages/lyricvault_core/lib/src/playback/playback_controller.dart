import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../models/song.dart';

class PlaybackController extends ChangeNotifier {
  final AudioPlayer _player;
  String _authToken;

  Song? _currentSong;
  String? _lastError;

  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration? _duration;

  StreamSubscription<PlayerState>? _playerStateSub;
  StreamSubscription<Duration>? _positionSub;
  StreamSubscription<Duration?>? _durationSub;

  PlaybackController({
    required String authToken,
    AudioPlayer? player,
  })  : _authToken = authToken,
        _player = player ?? AudioPlayer() {
    _playerStateSub = _player.playerStateStream.listen((state) {
      final next = state.playing;
      if (_isPlaying != next) {
        _isPlaying = next;
        notifyListeners();
      }
    });

    // Gate the notification frequency to avoid rebuilding the whole UI on
    // every audio tick.
    var lastNotified = Duration.zero;
    _positionSub = _player.positionStream.listen((pos) {
      _position = pos;
      if ((pos - lastNotified).abs() >= const Duration(milliseconds: 250)) {
        lastNotified = pos;
        notifyListeners();
      }
    });

    _durationSub = _player.durationStream.listen((dur) {
      _duration = dur;
      notifyListeners();
    });
  }

  Song? get currentSong => _currentSong;
  bool get isPlaying => _isPlaying;
  Duration get position => _position;
  Duration? get duration => _duration;
  String? get lastError => _lastError;

  void setAuthToken(String token) {
    if (token == _authToken) return;
    _authToken = token;
  }

  Future<void> playSong(Song song) async {
    _lastError = null;
    _currentSong = song;
    notifyListeners();

    if (song.streamUrl.isEmpty) {
      _lastError = 'Song has no stream URL';
      notifyListeners();
      return;
    }

    try {
      final uri = Uri.parse(song.streamUrl);
      await _player.setAudioSource(
        AudioSource.uri(
          uri,
          headers: {'X-LyricVault-Token': _authToken},
        ),
      );
      await _player.play();
    } catch (e) {
      _lastError = 'Playback failed: $e';
      notifyListeners();
    }
  }

  Future<void> play() => _player.play();
  Future<void> pause() => _player.pause();

  Future<void> togglePlayPause() async {
    if (_isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  Future<void> seek(Duration position) => _player.seek(position);

  @override
  void dispose() {
    final playerStateSub = _playerStateSub;
    if (playerStateSub != null) unawaited(playerStateSub.cancel());

    final positionSub = _positionSub;
    if (positionSub != null) unawaited(positionSub.cancel());

    final durationSub = _durationSub;
    if (durationSub != null) unawaited(durationSub.cancel());

    unawaited(_player.dispose());
    super.dispose();
  }
}
