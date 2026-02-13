import 'package:dio/dio.dart';

import '../models/song.dart';

class LyricVaultApi {
  final Dio _dio;

  LyricVaultApi({
    required String baseUrl,
    required String authToken,
    Dio? dio,
  }) : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 5),
                receiveTimeout: const Duration(seconds: 30),
                headers: {
                  'X-LyricVault-Token': authToken,
                },
              ),
            );

  Future<List<Song>> fetchLibrary() async {
    final response = await _dio.get('/library');
    final data = response.data;
    if (data is! List) {
      throw Exception('Unexpected /library response shape');
    }
    return data
        .whereType<Map>()
        .map((m) => Song.fromJson(m.cast<String, dynamic>()))
        .toList(growable: false);
  }

  Future<List<dynamic>> search(
    String query, {
    String platform = 'youtube',
  }) async {
    final response = await _dio.get(
      '/search',
      queryParameters: {'q': query, 'platform': platform},
    );
    final data = response.data;
    if (data is List) return data;
    throw Exception('Unexpected /search response shape');
  }

  Future<Song> fetchSong(int id) async {
    final response = await _dio.get('/song/$id');
    final data = response.data;
    if (data is! Map) {
      throw Exception('Unexpected /song/$id response shape');
    }
    return Song.fromJson(data.cast<String, dynamic>());
  }
}

