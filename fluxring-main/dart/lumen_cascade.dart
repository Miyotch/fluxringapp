// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/custom_code/actions/index.dart'; // Imports custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:math' as math;
import 'dart:ui' as ui;

/// Design 08: Lumen Cascade — FlutterFlow CustomWidget
///
/// React版の描画ロジックを忠実に再現。
/// - 40セグメント分割 × ガウシアン窓で光のカスケード
/// - screen合成で重なりが明るくなる方向に
/// - 多層ほわほわ（オーラ雲）エフェクト
/// - 強いグローと太い線

class LumenCascade extends StatefulWidget {
  const LumenCascade({
    super.key,
    this.width,
    this.height,
    this.amplitude = 1.0,
    this.variationId = '08-1',
    this.hue = 280,
    this.saturation = 75,
    this.rotationSpeedScale = 1.0,
    this.cascadeSpeedScale = 1.0,
    this.wobbleScale = 1.0,
    this.gaussianWidth = 1.5,
    this.baseSpeedMultiplier = 1.0,
    this.preventDarkening = true,
    this.interactive = true,
  });

  final double? width;
  final double? height;
  final double amplitude;
  final String variationId;
  final double hue;
  final double saturation;
  final double rotationSpeedScale;
  final double cascadeSpeedScale;
  final double wobbleScale;
  final double gaussianWidth;
  final double baseSpeedMultiplier;
  final bool preventDarkening;
  final bool interactive;

  static Map<String, dynamic>? getVariationPreset(String id) {
    return _variationPresets[id];
  }

  static final Map<String, Map<String, dynamic>> _variationPresets = {
    '08-1': {
      'hue': 270.0,
      'saturation': 58.0,
      'rotationSpeedScale': 1.3,
      'cascadeSpeedScale': 1.0,
      'wobbleScale': 1.0,
      'gaussianWidth': 1.5,
      'baseSpeedMultiplier': 1.0,
      'preventDarkening': true,
    },
    '08-2': {
      'hue': 190.0,
      'saturation': 55.0,
      'rotationSpeedScale': 1.0,
      'cascadeSpeedScale': 0.9,
      'wobbleScale': 0.8,
      'gaussianWidth': 2.2,
      'baseSpeedMultiplier': 1.0,
      'preventDarkening': false,
    },
    '08-3': {
      'hue': 38.0,
      'saturation': 65.0,
      'rotationSpeedScale': 1.1,
      'cascadeSpeedScale': 1.0,
      'wobbleScale': 1.6,
      'gaussianWidth': 1.5,
      'baseSpeedMultiplier': 1.0,
      'preventDarkening': false,
    },
    '08-4': {
      'hue': 340.0,
      'saturation': 52.0,
      'rotationSpeedScale': 1.0,
      'cascadeSpeedScale': 1.5,
      'wobbleScale': 1.0,
      'gaussianWidth': 1.5,
      'baseSpeedMultiplier': 1.0,
      'preventDarkening': false,
    },
    '08-5': {
      'hue': 155.0,
      'saturation': 55.0,
      'rotationSpeedScale': 1.2,
      'cascadeSpeedScale': 1.1,
      'wobbleScale': 1.0,
      'gaussianWidth': 0.8,
      'baseSpeedMultiplier': 1.0,
      'preventDarkening': false,
    },
    '08-1-1': {
      'hue': 270.0,
      'saturation': 58.0,
      'rotationSpeedScale': 1.3,
      'cascadeSpeedScale': 1.0,
      'wobbleScale': 0.9,
      'gaussianWidth': 1.8,
      'baseSpeedMultiplier': 1.2,
      'preventDarkening': true,
    },
    '08-1-2': {
      'hue': 268.0,
      'saturation': 60.0,
      'rotationSpeedScale': 1.35,
      'cascadeSpeedScale': 1.05,
      'wobbleScale': 1.0,
      'gaussianWidth': 1.6,
      'baseSpeedMultiplier': 1.3,
      'preventDarkening': true,
    },
    '08-1-3': {
      'hue': 270.0,
      'saturation': 58.0,
      'rotationSpeedScale': 1.4,
      'cascadeSpeedScale': 1.1,
      'wobbleScale': 1.0,
      'gaussianWidth': 1.5,
      'baseSpeedMultiplier': 1.4,
      'preventDarkening': true,
    },
    '08-1-4': {
      'hue': 272.0,
      'saturation': 56.0,
      'rotationSpeedScale': 1.45,
      'cascadeSpeedScale': 1.15,
      'wobbleScale': 1.1,
      'gaussianWidth': 1.4,
      'baseSpeedMultiplier': 1.55,
      'preventDarkening': true,
    },
    '08-1-5': {
      'hue': 265.0,
      'saturation': 62.0,
      'rotationSpeedScale': 1.5,
      'cascadeSpeedScale': 1.2,
      'wobbleScale': 1.2,
      'gaussianWidth': 1.3,
      'baseSpeedMultiplier': 1.7,
      'preventDarkening': true,
    },
  };

  @override
  State<LumenCascade> createState() => _LumenCascadeState();
}

class _LumenCascadeState extends State<LumenCascade>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late double _amplitude;
  double _lastAngle = 0;
  bool _isDragging = false;

  late double _hue;
  late double _saturation;
  late double _rotationSpeedScale;
  late double _cascadeSpeedScale;
  late double _wobbleScale;
  late double _gaussianWidth;
  late double _baseSpeedMultiplier;
  late bool _preventDarkening;

  @override
  void initState() {
    super.initState();
    _amplitude = widget.amplitude.clamp(0.2, 4.0);
    _resolveVariation();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat();
  }

  void _resolveVariation() {
    final preset = LumenCascade.getVariationPreset(widget.variationId);
    if (preset != null) {
      _hue = (preset['hue'] as num).toDouble();
      _saturation = (preset['saturation'] as num).toDouble();
      _rotationSpeedScale = (preset['rotationSpeedScale'] as num).toDouble();
      _cascadeSpeedScale = (preset['cascadeSpeedScale'] as num).toDouble();
      _wobbleScale = (preset['wobbleScale'] as num).toDouble();
      _gaussianWidth = (preset['gaussianWidth'] as num).toDouble();
      _baseSpeedMultiplier =
          (preset['baseSpeedMultiplier'] as num).toDouble();
      _preventDarkening = preset['preventDarkening'] as bool;
    } else {
      _hue = widget.hue;
      _saturation = widget.saturation;
      _rotationSpeedScale = widget.rotationSpeedScale;
      _cascadeSpeedScale = widget.cascadeSpeedScale;
      _wobbleScale = widget.wobbleScale;
      _gaussianWidth = widget.gaussianWidth;
      _baseSpeedMultiplier = widget.baseSpeedMultiplier;
      _preventDarkening = widget.preventDarkening;
    }
  }

  @override
  void didUpdateWidget(covariant LumenCascade oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.amplitude != widget.amplitude && !_isDragging) {
      _amplitude = widget.amplitude.clamp(0.2, 4.0);
    }
    if (oldWidget.variationId != widget.variationId ||
        oldWidget.hue != widget.hue ||
        oldWidget.saturation != widget.saturation) {
      _resolveVariation();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onPanStart(DragStartDetails details) {
    if (!widget.interactive) return;
    final RenderBox box = context.findRenderObject() as RenderBox;
    final center = box.size.center(Offset.zero);
    final local = details.localPosition;
    _lastAngle = math.atan2(local.dy - center.dy, local.dx - center.dx);
    _isDragging = true;
  }

  void _onPanUpdate(DragUpdateDetails details) {
    if (!widget.interactive || !_isDragging) return;
    final RenderBox box = context.findRenderObject() as RenderBox;
    final center = box.size.center(Offset.zero);
    final local = details.localPosition;
    final angle = math.atan2(local.dy - center.dy, local.dx - center.dx);
    var delta = angle - _lastAngle;
    if (delta > math.pi) delta -= 2 * math.pi;
    if (delta < -math.pi) delta += 2 * math.pi;
    _lastAngle = angle;
    setState(() {
      _amplitude = (_amplitude - delta * 1.5).clamp(0.2, 4.0);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    _isDragging = false;
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.width ?? MediaQuery.of(context).size.width;
    final h = widget.height ?? MediaQuery.of(context).size.height;
    final size = math.min(w, h);

    return GestureDetector(
      onPanStart: widget.interactive ? _onPanStart : null,
      onPanUpdate: widget.interactive ? _onPanUpdate : null,
      onPanEnd: widget.interactive ? _onPanEnd : null,
      child: SizedBox(
        width: w,
        height: h,
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return CustomPaint(
                size: Size(size, size),
                painter: _LumenCascadePainter(
                  time: DateTime.now().millisecondsSinceEpoch / 1000.0,
                  amplitude: _amplitude,
                  hue: _hue,
                  saturation: _saturation,
                  rotationSpeedScale: _rotationSpeedScale,
                  cascadeSpeedScale: _cascadeSpeedScale,
                  wobbleScale: _wobbleScale,
                  gaussianWidth: _gaussianWidth,
                  baseSpeedMultiplier: _baseSpeedMultiplier,
                  preventDarkening: _preventDarkening,
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _LumenCascadePainter extends CustomPainter {
  _LumenCascadePainter({
    required this.time,
    required this.amplitude,
    required this.hue,
    required this.saturation,
    required this.rotationSpeedScale,
    required this.cascadeSpeedScale,
    required this.wobbleScale,
    required this.gaussianWidth,
    required this.baseSpeedMultiplier,
    required this.preventDarkening,
  });

  final double time;
  final double amplitude;
  final double hue;
  final double saturation;
  final double rotationSpeedScale;
  final double cascadeSpeedScale;
  final double wobbleScale;
  final double gaussianWidth;
  final double baseSpeedMultiplier;
  final bool preventDarkening;

  static final double _startTime =
      DateTime.now().millisecondsSinceEpoch / 1000.0;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final cy = h / 2;
    final minSide = math.min(w, h);
    final maxR = minSide / 2 - 10;
    final orbR = minSide * 0.095; // React: 38px at ~400px canvas
    final animTime = time - _startTime;

    final tNorm = ((amplitude - 0.2) / 3.8).clamp(0.0, 1.0);
    final level = (tNorm * 5).floor().clamp(0, 4) + 1;
    final noDarken = preventDarkening;

    // ================================================================
    // 1. 背景グロー（sphere.png 相当）
    // ================================================================
    final bgGlowAlpha =
        noDarken ? 0.25 + level * 0.08 : 0.2 + level * 0.06;
    _drawBackgroundGlow(canvas, cx, cy, minSide, bgGlowAlpha);

    // ================================================================
    // 2. リング描画（React版の40セグメント×ガウシアン窓を忠実に再現）
    // ================================================================
    final ringCount = noDarken
        ? (3 + (level - 1) * 3) // Lv1:3→Lv5:15
        : (10 + (level - 1) * 5);
    const segments = 40;

    // レベル遷移フェード
    final levelFloat = tNorm * 5;
    final levelFrac = levelFloat - levelFloat.floor();
    final fadeAlpha = levelFrac < 0.25 ? levelFrac / 0.25 : 1.0;

    // 回転加速（React版と同じ計算式）
    final accelDamping = 1.0 / math.sqrt(baseSpeedMultiplier);
    final baseSpeed = 0.3 * rotationSpeedScale * baseSpeedMultiplier;
    final levelBoost = level * 0.08 * rotationSpeedScale * accelDamping;

    // screen合成: PictureRecorderでオフスクリーン描画
    ui.PictureRecorder? recorder;
    Canvas ringCanvas = canvas;

    if (noDarken) {
      recorder = ui.PictureRecorder();
      ringCanvas = Canvas(recorder, Rect.fromLTWH(0, 0, w, h));
    }

    for (int i = 0; i < ringCount; i++) {
      final t = i / ringCount;
      final baseR = orbR + 12 + t * (maxR - orbR - 24);
      final rotation = animTime * (baseSpeed + levelBoost);
      final cascadePhase = animTime *
              (0.6 * baseSpeedMultiplier +
                  level * 0.1 * accelDamping) *
              cascadeSpeedScale +
          i * 0.4;

      ringCanvas.save();
      ringCanvas.translate(cx, cy);
      ringCanvas.rotate(rotation + i * 0.03);

      for (int s = 0; s < segments; s++) {
        final segStart = (s / segments) * math.pi * 2;
        final segEnd = ((s + 1) / segments) * math.pi * 2;
        final segMid = (segStart + segEnd) / 2;

        // ガウシアン窓でカスケード明度
        var angleDelta = segMid - cascadePhase;
        while (angleDelta > math.pi) angleDelta -= math.pi * 2;
        while (angleDelta < -math.pi) angleDelta += math.pi * 2;
        final brightness =
            math.exp(-(angleDelta * angleDelta) / gaussianWidth);

        // alpha計算（React版完全準拠）
        final levelAlphaBoost = level * 0.08;
        final levelVisibility =
            noDarken ? 0.15 + (level - 1) * 0.12 : 1.0;
        final darkDimming = (noDarken && level >= 4)
            ? 0.3 + brightness * 0.7
            : 1.0;
        final rawAlpha = (0.12 +
                (1 - t) * 0.1 +
                levelAlphaBoost +
                brightness * (0.25 + amplitude * 0.06)) *
            fadeAlpha *
            levelVisibility *
            darkDimming;
        final alphaLimit = noDarken ? 0.6 : 1.0;
        final alpha = math.min(alphaLimit, rawAlpha).clamp(0.0, 1.0);

        final segHue = hue + t * 25;
        final sat = noDarken
            ? saturation + t * 8 + level * 2
            : saturation + t * 10;
        final lightness =
            noDarken ? 70.0 + level * 2.5 : 76.0 + level * 2.0;

        // セグメントのパス構築（4点＋ウォブル）
        final path = Path();
        const segPoints = 4;
        for (int p = 0; p <= segPoints; p++) {
          final angle =
              segStart + (p / segPoints) * (segEnd - segStart);
          final ampForWobble = noDarken
              ? math.min(amplitude, 2.0 + level * 0.3)
              : amplitude;
          final wobbleVal =
              (math.sin(angle * 2 + animTime + i * 0.7) *
                          ampForWobble *
                          3 +
                      math.sin(angle * 4 + animTime * 1.3 + i) *
                          ampForWobble *
                          1.5) *
                  wobbleScale;
          final r = baseR + wobbleVal;
          final x = r * math.cos(angle);
          final y = r * math.sin(angle);
          if (p == 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }

        // 色
        final color = HSLColor.fromAHSL(
          alpha,
          segHue % 360,
          (sat / 100).clamp(0.0, 1.0),
          (lightness / 100).clamp(0.0, 1.0),
        ).toColor();

        // 線の太さ（React版準拠: 太め）
        final lineScale =
            noDarken ? 0.4 + (level - 1) * 0.15 : 1.0;
        final strokeW =
            (0.8 + (1 - t) * 1.2 + brightness * 0.5) * lineScale;

        // アフターグロー（brightness > 0.4 のセグメントに強い発光）
        final glowBoost = 1.0 + level * 0.15;
        if (brightness > 0.4) {
          final glowLightness = noDarken ? 72.0 + level * 1.5 : 82.0;
          final glowAlpha =
              (brightness * 0.35 * fadeAlpha * glowBoost).clamp(0.0, 1.0);
          final glowColor = HSLColor.fromAHSL(
            glowAlpha,
            segHue % 360,
            (sat / 100).clamp(0.0, 1.0),
            (glowLightness / 100).clamp(0.0, 1.0),
          ).toColor();

          final glowPaint = Paint()
            ..color = glowColor
            ..style = PaintingStyle.stroke
            ..strokeWidth = strokeW + 4 + level * 2
            ..maskFilter = MaskFilter.blur(
                BlurStyle.normal, 6.0 + level * 2.0);
          ringCanvas.drawPath(path, glowPaint);
        }

        // 実線
        final paint = Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = strokeW;
        ringCanvas.drawPath(path, paint);
      }

      ringCanvas.restore();
    }

    // オフスクリーンをscreen合成でメインCanvasに描画
    if (noDarken && recorder != null) {
      final picture = recorder.endRecording();
      canvas.save();
      canvas.saveLayer(
        Rect.fromLTWH(0, 0, w, h),
        Paint()
          ..blendMode = BlendMode.screen
          ..color = const Color(0xE6FFFFFF), // globalAlpha 0.9
      );
      canvas.drawPicture(picture);
      canvas.restore();
      canvas.restore();
      picture.dispose();
    }

    // ================================================================
    // 3. ほわほわエフェクト（オーラ雲 — screen合成、多層グラデーション）
    // ================================================================
    final howaAmp = noDarken ? math.min(amplitude, 2.5) : amplitude;
    _drawHowahowa(canvas, cx, cy, minSide, animTime, howaAmp, level);

    // ================================================================
    // 4. リングオーバーレイ（ring-overlay.png相当 — 薄い回転リング）
    // ================================================================
    _drawRingOverlay(canvas, cx, cy, minSide, animTime);

    // ================================================================
    // 5. リングレベル（noDarkenではスキップ — React版準拠）
    // ================================================================
    if (!noDarken) {
      _drawRingLevel(canvas, cx, cy, minSide, animTime, amplitude);
    }

    // ================================================================
    // 6. 光のアニメーション（きらめき）
    // ================================================================
    _drawLightAnimation(canvas, cx, cy, minSide, animTime, amplitude);

    // ================================================================
    // 7. 中心ユニット（紫グロー + ベゼル + ノブ）
    // ================================================================
    _drawCenterUnit(canvas, cx, cy, orbR, amplitude);
  }

  /// 背景グロー — sphere.png相当
  /// 3層のradialグラデーションで深い発光感を出す
  void _drawBackgroundGlow(
      Canvas canvas, double cx, double cy, double size, double alpha) {
    final drawSize = size * 0.9;

    // 第1層: 広域の柔らかい発光
    final paint1 = Paint()
      ..shader = ui.Gradient.radial(
        Offset(cx, cy),
        drawSize / 2,
        [
          HSLColor.fromAHSL(
                  (alpha * 0.8).clamp(0.0, 1.0), hue % 360, 0.6, 0.7)
              .toColor(),
          HSLColor.fromAHSL(
                  (alpha * 0.4).clamp(0.0, 1.0), (hue + 20) % 360, 0.5, 0.5)
              .toColor(),
          Colors.transparent,
        ],
        [0.0, 0.4, 1.0],
      );
    canvas.drawCircle(Offset(cx, cy), drawSize / 2, paint1);

    // 第2層: 中心部の強い発光
    final paint2 = Paint()
      ..shader = ui.Gradient.radial(
        Offset(cx, cy),
        drawSize * 0.3,
        [
          HSLColor.fromAHSL(
                  (alpha * 1.2).clamp(0.0, 1.0), (hue - 10) % 360, 0.7, 0.8)
              .toColor(),
          HSLColor.fromAHSL(
                  (alpha * 0.5).clamp(0.0, 1.0), hue % 360, 0.5, 0.6)
              .toColor(),
          Colors.transparent,
        ],
        [0.0, 0.5, 1.0],
      );
    canvas.drawCircle(Offset(cx, cy), drawSize * 0.3, paint2);
  }

  /// ほわほわエフェクト — howahowa PNGs相当
  /// 多層radialグラデーション × screen合成で雲のようなオーラを再現
  /// React: opacity 0.8, blendMode screen, ゆっくり回転
  void _drawHowahowa(Canvas canvas, double cx, double cy, double size,
      double time, double amp, int level) {
    final drawSize = size * 0.95;
    // レベルに応じた層数（Lv1:3層→Lv5:8層）
    final layerCount = 3 + level;

    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(time * 0.06); // React: time * 0.06

    // screen合成レイヤー（React: globalAlpha 0.8, screen）
    canvas.saveLayer(
      Rect.fromLTWH(-drawSize / 2, -drawSize / 2, drawSize, drawSize),
      Paint()
        ..blendMode = BlendMode.screen
        ..color = const Color(0xCC000000), // alpha 0.8
    );

    for (int i = 0; i < layerCount; i++) {
      final layerT = i / math.max(1, layerCount - 1);
      final angleOffset = i * math.pi * 2 / layerCount;

      // 各層を少しずつずらして配置（有機的な雲感）
      final ox = math.cos(time * 0.12 + angleOffset) * drawSize * 0.06;
      final oy = math.sin(time * 0.12 + angleOffset) * drawSize * 0.06;

      // 内側の層ほど明るく、外側ほど広く薄い
      final innerR = drawSize * (0.1 + layerT * 0.06);
      final outerR = drawSize * (0.2 + layerT * 0.18);
      final layerAlpha = (0.3 + amp * 0.08 - layerT * 0.1).clamp(0.05, 0.55);

      // 色相を層ごとにシフト（紫→ピンク→シアンの多色感）
      final layerHue = (hue + i * 18) % 360;

      // 内側グラデーション（強い発光）
      final innerPaint = Paint()
        ..shader = ui.Gradient.radial(
          Offset(ox, oy),
          outerR,
          [
            HSLColor.fromAHSL(layerAlpha, layerHue, 0.65, 0.7).toColor(),
            HSLColor.fromAHSL(layerAlpha * 0.6, (layerHue + 10) % 360, 0.5, 0.55)
                .toColor(),
            HSLColor.fromAHSL(layerAlpha * 0.2, (layerHue + 20) % 360, 0.4, 0.4)
                .toColor(),
            Colors.transparent,
          ],
          [0.0, 0.3, 0.6, 1.0],
        )
        ..maskFilter = MaskFilter.blur(
            BlurStyle.normal, 15.0 + level * 5.0); // Figma: LAYER_BLUR 42相当

      canvas.drawCircle(Offset(ox, oy), outerR, innerPaint);

      // 外側の広い拡散光（薄く広範囲）
      if (layerT < 0.7) {
        final outerAlpha = (layerAlpha * 0.35).clamp(0.0, 0.25);
        final spreadR = drawSize * (0.3 + layerT * 0.12);
        final outerPaint = Paint()
          ..shader = ui.Gradient.radial(
            Offset(ox * 1.5, oy * 1.5),
            spreadR,
            [
              HSLColor.fromAHSL(outerAlpha, layerHue, 0.5, 0.65).toColor(),
              Colors.transparent,
            ],
          )
          ..maskFilter =
              MaskFilter.blur(BlurStyle.normal, 25.0 + level * 4.0);
        canvas.drawCircle(Offset(ox * 1.5, oy * 1.5), spreadR, outerPaint);
      }
    }

    canvas.restore(); // saveLayer (screen)
    canvas.restore(); // translate/rotate
  }

  /// リングオーバーレイ — ring-overlay.png相当
  /// React: alpha 0.12, ゆっくり回転
  void _drawRingOverlay(
      Canvas canvas, double cx, double cy, double size, double time) {
    final drawSize = size * 0.85;

    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(time * 0.1);

    // 3層の薄い円弧オーバーレイ
    for (int i = 0; i < 3; i++) {
      final r = drawSize * (0.22 + i * 0.12);
      final overlayAlpha = 0.08 + i * 0.02;
      final paint = Paint()
        ..color = HSLColor.fromAHSL(
                overlayAlpha, (hue + i * 5) % 360, 0.35, 0.75)
            .toColor()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2 + i * 0.3;
      canvas.drawCircle(Offset.zero, r, paint);
    }

    canvas.restore();
  }

  /// リングレベル — ring-levels.png相当（multiply合成）
  /// React: opacity 0.4, blendMode multiply
  void _drawRingLevel(Canvas canvas, double cx, double cy, double size,
      double time, double amp) {
    final drawSize = size * 0.95;
    final t = ((amp - 0.2) / 3.8).clamp(0.0, 1.0);
    final levelCount = (5 - (t * 5).floor().clamp(0, 4));

    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(time * 0.08);

    canvas.saveLayer(
      Rect.fromLTWH(-drawSize / 2, -drawSize / 2, drawSize, drawSize),
      Paint()
        ..blendMode = BlendMode.multiply
        ..color = const Color(0x66FFFFFF),
    );

    for (int i = 0; i < levelCount; i++) {
      final r = drawSize * (0.12 + i * 0.08);
      final ringAlpha = 0.2 + (1 - i / math.max(1, levelCount)) * 0.15;
      final paint = Paint()
        ..color =
            HSLColor.fromAHSL(ringAlpha, hue % 360, 0.25, 0.55).toColor()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0 + i * 0.5
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4.0);
      canvas.drawCircle(Offset.zero, r, paint);
    }

    canvas.restore(); // saveLayer
    canvas.restore();
  }

  /// 光のアニメーション — light-anim PNGs相当
  /// React: 3バリアント、逆回転 -time*0.15、alpha 0.7*(0.6+t*0.4)
  void _drawLightAnimation(Canvas canvas, double cx, double cy, double size,
      double time, double amp) {
    final t = ((amp - 0.2) / 3.8).clamp(0.0, 1.0);
    final drawSize = size * 0.6;
    final baseAlpha = 0.7 * (0.6 + t * 0.4);

    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(-time * 0.15);

    // きらめきドット（星＋光ドット）
    final sparkCount = (4 + t * 5).toInt();
    for (int i = 0; i < sparkCount; i++) {
      final angle = i * math.pi * 2 / sparkCount + time * 0.2;
      final dist = drawSize * (0.08 + 0.18 * math.sin(time * 0.5 + i));
      final x = math.cos(angle) * dist;
      final y = math.sin(angle) * dist;
      final sparkAlpha = (baseAlpha * (0.3 + 0.7 * math.sin(time * 2 + i)))
          .clamp(0.0, 1.0);

      // 発光ドット
      final dotPaint = Paint()
        ..color = HSLColor.fromAHSL(
                sparkAlpha, (hue + 30) % 360, 0.4, 0.92)
            .toColor()
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
      canvas.drawCircle(Offset(x, y), 2.5 + t * 3, dotPaint);

      // 十字のきらめき線
      final crossAlpha = sparkAlpha * 0.5;
      final crossPaint = Paint()
        ..color = HSLColor.fromAHSL(
                crossAlpha, (hue + 30) % 360, 0.25, 0.95)
            .toColor()
        ..strokeWidth = 0.6;
      final crossLen = 5.0 + t * 6;
      canvas.drawLine(
          Offset(x - crossLen, y), Offset(x + crossLen, y), crossPaint);
      canvas.drawLine(
          Offset(x, y - crossLen), Offset(x, y + crossLen), crossPaint);
    }

    canvas.restore();
  }

  /// 中心ユニット（紫アクセントグロー + ベゼル + ノブ）
  /// React: sphereGlow alpha 0.7 → bezel soft-light → knob
  void _drawCenterUnit(
      Canvas canvas, double cx, double cy, double orbR, double amp) {
    // 1. 紫アクセントグロー（ベゼルの下から覗く）
    final glowSize = orbR * 2.6;
    final glowPaint = Paint()
      ..shader = ui.Gradient.radial(
        Offset(cx, cy),
        glowSize / 2,
        [
          HSLColor.fromAHSL(0.7, hue % 360, 0.6, 0.55).toColor(),
          HSLColor.fromAHSL(0.35, (hue + 15) % 360, 0.5, 0.4).toColor(),
          Colors.transparent,
        ],
        [0.0, 0.45, 1.0],
      );
    canvas.drawCircle(Offset(cx, cy), glowSize / 2, glowPaint);

    // 2. ベゼルリング（soft-light合成）
    final bezelPaint = Paint()
      ..color = const Color(0xD9FFFFFF) // rgba(255,255,255,0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = orbR * 0.08;
    canvas.save();
    canvas.saveLayer(
      Rect.fromLTRB(cx - orbR * 1.3, cy - orbR * 1.3, cx + orbR * 1.3,
          cy + orbR * 1.3),
      Paint()..blendMode = BlendMode.softLight,
    );
    canvas.drawCircle(Offset(cx, cy), orbR * 1.06, bezelPaint);
    canvas.restore();
    canvas.restore();

    // 3. 影
    final shadowPaint = Paint()
      ..color = const Color(0x28000000)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, orbR * 0.2);
    canvas.drawCircle(
        Offset(cx, cy + orbR * 0.08), orbR * 0.95, shadowPaint);

    // 4. ノブ本体
    _drawKnob(canvas, cx, cy, orbR, amp);
  }

  /// ノブ描画（回転 + グラデーション + ドットインジケーター + テキスト）
  void _drawKnob(
      Canvas canvas, double cx, double cy, double orbR, double amp) {
    final rotation =
        ((amp - 0.2) / 3.8) * math.pi * 1.67 - math.pi * 0.83;

    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(rotation);

    // ノブ本体グラデーション
    final grad = ui.Gradient.radial(
      Offset(-orbR * 0.15, -orbR * 0.15),
      orbR,
      [
        const Color(0xFAEBE6F8), // rgba(235,230,248,0.98)
        const Color(0xF2E1DAF2), // rgba(225,218,242,0.95)
        const Color(0xE6D2C8EB), // rgba(210,200,235,0.9)
      ],
      [0.0, 0.7, 1.0],
    );
    canvas.drawCircle(Offset.zero, orbR, Paint()..shader = grad);

    // ドットインジケーター
    canvas.drawCircle(
      Offset(0, orbR * 0.65),
      orbR * 0.1,
      Paint()..color = const Color(0xB3D2C3E6),
    );

    canvas.restore();

    // テキスト（回転しない）
    final level = ((((amp - 0.2) / 3.8).clamp(0.0, 1.0) * 5)
                .floor()
                .clamp(0, 4) +
            1)
        .toString()
        .padLeft(2, '0');

    final levelPainter = TextPainter(
      text: TextSpan(
        text: level,
        style: TextStyle(
          fontSize: orbR * 0.55,
          fontWeight: FontWeight.w200,
          color: const Color(0x80A091C3),
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: ui.TextDirection.ltr,
    )..layout();
    levelPainter.paint(
      canvas,
      Offset(cx - levelPainter.width / 2,
          cy - orbR * 0.05 - levelPainter.height / 2),
    );

    final labelPainter = TextPainter(
      text: TextSpan(
        text: 'Flux Ring',
        style: TextStyle(
          fontSize: orbR * 0.18,
          fontWeight: FontWeight.w300,
          color: const Color(0x66A091C3),
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: ui.TextDirection.ltr,
    )..layout();
    labelPainter.paint(
      canvas,
      Offset(cx - labelPainter.width / 2,
          cy + orbR * 0.35 - labelPainter.height / 2),
    );
  }

  @override
  bool shouldRepaint(covariant _LumenCascadePainter oldDelegate) => true;
}
