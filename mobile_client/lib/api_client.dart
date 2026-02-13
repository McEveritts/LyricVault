import 'package:dio/dio.dart';
import 'models.dart';

class LyricVaultApi {
  final Dio _dio;
  final String _authToken;

  LyricVaultApi({
    required String baseUrl,
    required String authToken,
  })  : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          headers: {
            'X-LyricVault-Token': authToken,
          },
        )),
        _authToken = authToken;

  Future<List<Song>> fetchLibrary() async {
    try {
      final response = await _dio.get('/library');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => Song.fromJson(json)).toList();
      }
      throw Exception('Failed to load library: ${response.statusCode}');
    } catch (e) {
      throw Exception('API Error: $e');
    }
  }

  Future<List<dynamic>> search(String query, {String platform = 'youtube'}) async {
    try {
      final response = await _dio.get(
        '/search',
        queryParameters: {'q': query, 'platform': platform},
      );
      if (response.statusCode == 200) {
        return response.data;
      }
      throw Exception('Failed to search: ${response.statusCode}');
    } catch (e) {
      throw Exception('API Error: $e');
    }
  }
}
