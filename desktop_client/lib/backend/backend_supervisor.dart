import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'backend_instance.dart';

typedef BackendStatusCallback = void Function(String message);
typedef BackendLogCallback = void Function(String line);

class BackendSupervisor {
  static Future<BackendInstance> start({
    Duration timeout = const Duration(seconds: 15),
    BackendStatusCallback? onStatus,
    BackendLogCallback? onLog,
  }) async {
    onStatus?.call('Locating repo root...');
    final repoRoot = _findRepoRoot();
    final backendScript =
        File('${repoRoot.path}${Platform.pathSeparator}backend${Platform.pathSeparator}main.py');
    if (!backendScript.existsSync()) {
      throw Exception('Missing backend script: ${backendScript.path}');
    }
    onStatus?.call('Found backend script: ${backendScript.path}');

    onStatus?.call('Resolving Python interpreter...');
    final pythonExe = _resolvePythonExe(repoRoot);
    if (pythonExe == null) {
      throw Exception(
        'Could not find a Python interpreter.\n'
        'Run `scripts/setup-python.ps1` (or `npm run setup:python`) to download the embedded Python, '
        'or install Python and ensure `python` is available on PATH.',
      );
    }
    onStatus?.call('Using Python: $pythonExe');

    onStatus?.call('Picking a free port...');
    final port = await _pickPort();
    final token = _randomHex(32);
    final baseUrl = 'http://127.0.0.1:$port';
    onStatus?.call('Starting backend on port $port...');

    final env = Map<String, String>.from(Platform.environment);
    env['LYRICVAULT_BACKEND_PORT'] = port.toString();
    env['LYRICVAULT_API_TOKEN'] = token;
    env['LYRICVAULT_APP_VERSION'] = '0.5.0-desktop';

    late final Process process;
    try {
      process = await Process.start(
        pythonExe,
        [backendScript.path],
        workingDirectory: backendScript.parent.path,
        environment: env,
        runInShell: false,
      );
    } on ProcessException catch (e) {
      throw Exception('Failed to start backend ($pythonExe): ${e.message}');
    }

    // Pipe backend logs into the Flutter process output for debugging.
    process.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((line) {
      stdout.writeln('[backend] $line');
      onLog?.call('stdout: $line');
    });
    process.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((line) {
      stderr.writeln('[backend] $line');
      onLog?.call('stderr: $line');
    });

    onStatus?.call('Waiting for backend health check...');
    final ready = await _waitForBackend(
      baseUrl: baseUrl,
      token: token,
      timeout: timeout,
      process: process,
      onStatus: onStatus,
    );

    if (!ready) {
      try {
        process.kill(ProcessSignal.sigkill);
      } catch (_) {}
      throw Exception('Backend failed to start within ${timeout.inSeconds}s');
    }

    onStatus?.call('Backend ready ($baseUrl)');
    return BackendInstance(
      baseUrl: baseUrl,
      token: token,
      port: port,
      process: process,
    );
  }

  static Directory _findRepoRoot() {
    var dir = Directory.current.absolute;
    while (true) {
      final candidate = File('${dir.path}${Platform.pathSeparator}backend${Platform.pathSeparator}main.py');
      if (candidate.existsSync()) return dir;
      final parent = dir.parent;
      if (parent.path == dir.path) break;
      dir = parent;
    }
    return Directory.current.absolute;
  }

  static String? _resolvePythonExe(Directory repoRoot) {
    final venvPython = File(
      '${repoRoot.path}${Platform.pathSeparator}backend${Platform.pathSeparator}venv${Platform.pathSeparator}Scripts${Platform.pathSeparator}python.exe',
    );
    if (venvPython.existsSync()) return venvPython.path;

    final embedPython = File(
      '${repoRoot.path}${Platform.pathSeparator}python-embed${Platform.pathSeparator}python.exe',
    );
    if (embedPython.existsSync()) return embedPython.path;

    if (Platform.isWindows) {
      return _which('where', 'python.exe') ?? _which('where', 'python');
    }
    return _which('which', 'python3') ?? _which('which', 'python');
  }

  static String? _which(String tool, String command) {
    try {
      final result = Process.runSync(tool, [command]);
      if (result.exitCode != 0) return null;
      final out = (result.stdout as String).trim();
      if (out.isEmpty) return null;
      final first = out.split(RegExp(r'\r?\n')).first.trim();
      return first.isEmpty ? null : first;
    } catch (_) {
      return null;
    }
  }

  static Future<int> _pickPort() async {
    final socket = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    final port = socket.port;
    await socket.close();
    return port;
  }

  static String _randomHex(int bytes) {
    final rng = Random.secure();
    final data = List<int>.generate(bytes, (_) => rng.nextInt(256));
    final sb = StringBuffer();
    for (final b in data) {
      sb.write(b.toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString();
  }

  static Future<bool> _waitForBackend({
    required String baseUrl,
    required String token,
    required Duration timeout,
    required Process process,
    BackendStatusCallback? onStatus,
  }) async {
    final http = HttpClient()..connectionTimeout = const Duration(seconds: 1);
    var exited = false;
    unawaited(process.exitCode.then((_) => exited = true));
    final startedAt = DateTime.now();
    var lastSecond = -1;
    final deadline = DateTime.now().add(timeout);

    while (DateTime.now().isBefore(deadline)) {
      if (exited) return false;

      final elapsedSeconds = DateTime.now().difference(startedAt).inSeconds;
      if (elapsedSeconds != lastSecond) {
        lastSecond = elapsedSeconds;
        onStatus?.call('Waiting for backend... ${elapsedSeconds}s / ${timeout.inSeconds}s');
      }

      try {
        final req = await http.getUrl(Uri.parse('$baseUrl/'));
        req.headers.set('X-LyricVault-Token', token);
        final res = await req.close();
        if (res.statusCode == 200) {
          http.close(force: true);
          return true;
        }
      } catch (_) {
        // Retry.
      }

      await Future<void>.delayed(const Duration(milliseconds: 500));
    }

    http.close(force: true);
    return false;
  }
}
