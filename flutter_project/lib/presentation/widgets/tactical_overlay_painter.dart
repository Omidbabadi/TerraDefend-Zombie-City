import 'package:flutter/material.dart';
import '../../domain/entities/city_sector_entity.dart';
import '../../domain/entities/defense_entities.dart';

class TacticalOverlayPainter extends CustomPainter {
  final CitySectorEntity? sector;
  final List<DefenseTowerEntity> towers;
  final List<TroopSquadEntity> squads;
  final List<ZombieHostileEntity> hostiles;
  final bool isOfflineVectorMode;

  TacticalOverlayPainter({
    required this.sector,
    required this.towers,
    required this.squads,
    required this.hostiles,
    required this.isOfflineVectorMode,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (isOfflineVectorMode) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()..color = const Color(0xFF090D16),
      );
    }

    final currentSector = sector;
    if (currentSector == null) return;

    // 1. Draw Cached Urban Road Corridors
    final roadPaint = Paint()
      ..color = const Color(0xDD1E293B)
      ..strokeWidth = 24.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    for (final corridor in currentSector.corridors) {
      if (corridor.waypoints.length < 2) continue;
      final path = Path();
      for (var i = 0; i < corridor.waypoints.length; i++) {
        final pt = corridor.waypoints[i];
        final px = pt.x * size.width;
        final py = pt.y * size.height;
        if (i == 0) {
          path.moveTo(px, py);
        } else {
          path.lineTo(px, py);
        }
      }
      canvas.drawPath(path, roadPaint);
    }

    // 2. Draw Central HQ Command Bunker & Automated Point-Defense Cannon at (0.5, 0.5)
    final hqCenter = Offset(size.width * 0.5, size.height * 0.5);
    canvas.drawCircle(
      hqCenter,
      168.0 * 0.65,
      Paint()
        ..color = const Color(0x28F59E0B)
        ..strokeWidth = 1.2
        ..style = PaintingStyle.stroke,
    );
    canvas.drawCircle(
      hqCenter,
      26.0,
      Paint()..color = const Color(0xFF0F172A),
    );
    canvas.drawCircle(
      hqCenter,
      26.0,
      Paint()
        ..color = const Color(0xFF38BDF8)
        ..strokeWidth = 3.0
        ..style = PaintingStyle.stroke,
    );
    // Aim HQ twin-barrel cannon toward closest hostile in range
    if (hostiles.isNotEmpty) {
      final target = hostiles.first;
      final targetPos = Offset(
        target.normX * size.width,
        target.normY * size.height,
      );
      final dir = targetPos - hqCenter;
      final dist = dir.distance;
      if (dist > 1.0) {
        final barrelEnd = hqCenter + (dir / dist) * 26.0;
        canvas.drawLine(
          hqCenter,
          barrelEnd,
          Paint()
            ..color = const Color(0xFFFBBF24)
            ..strokeWidth = 6.0
            ..strokeCap = StrokeCap.round,
        );
      }
    }
    canvas.drawCircle(
      hqCenter,
      10.0,
      Paint()..color = const Color(0xFFF59E0B),
    );

    // 3. Draw Deployed Towers & Range Rings
    for (final tower in towers) {
      final pos = Offset(tower.normX * size.width, tower.normY * size.height);
      canvas.drawCircle(
        pos,
        tower.rangeMeters * 0.65,
        Paint()..color = const Color(0x1838BDF8),
      );
      canvas.drawCircle(
        pos,
        13.0,
        Paint()..color = const Color(0xFF38BDF8),
      );
    }

    // 4. Draw Mobile Strike Squads
    for (final squad in squads) {
      final pos = Offset(squad.normX * size.width, squad.normY * size.height);
      final rally = Offset(
        squad.rallyNormX * size.width,
        squad.rallyNormY * size.height,
      );
      canvas.drawLine(
        pos,
        rally,
        Paint()
          ..color = const Color(0x5510B981)
          ..strokeWidth = 1.5,
      );
      canvas.drawCircle(
        rally,
        10.0,
        Paint()..color = const Color(0xFF10B981),
      );
    }

    // 5. Draw Zombie Hostiles
    for (final z in hostiles) {
      final pos = Offset(z.normX * size.width, z.normY * size.height);
      final radius = z.archetype == ZombieArchetype.juggernaut ? 13.0 : 8.5;
      final color = z.archetype == ZombieArchetype.juggernaut
          ? const Color(0xFF7F1D1D)
          : z.archetype == ZombieArchetype.runner
              ? const Color(0xFFF97316)
              : const Color(0xFFDC2626);

      canvas.drawCircle(pos, radius, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant TacticalOverlayPainter oldDelegate) => true;
}
