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

  void _drawSquareZone(
    Canvas canvas,
    Size size, {
    required double centerNormX,
    required double centerNormY,
    required double halfSpanNorm,
    required Color fillColor,
    required Color borderColor,
  }) {
    final cx = centerNormX * size.width;
    final cy = centerNormY * size.height;
    final halfW = halfSpanNorm * size.width;
    final halfH = halfSpanNorm * size.height;
    final rect = Rect.fromLTRB(cx - halfW, cy - halfH, cx + halfW, cy + halfH);

    canvas.drawRect(rect, Paint()..color = fillColor);
    canvas.drawRect(
      rect,
      Paint()
        ..color = borderColor
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke,
    );
  }

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

    // 1. Draw SQUARE HQ Player-Controlled Zones (ONLY Primary HQ and Forward HQs grant Player Zones!)
    _drawSquareZone(
      canvas,
      size,
      centerNormX: 0.5,
      centerNormY: 0.5,
      halfSpanNorm: 0.28,
      fillColor: const Color(0x1810B981),
      borderColor: const Color(0xCC10B981),
    );

    for (final tower in towers) {
      if (tower.type == DeployableType.forwardHqBase) {
        _drawSquareZone(
          canvas,
          size,
          centerNormX: tower.normX,
          centerNormY: tower.normY,
          halfSpanNorm: 0.24,
          fillColor: const Color(0x1810B981),
          borderColor: const Color(0xCC10B981),
        );
      } else if (tower.type == DeployableType.heavyFortress) {
        // Heavy Fortress SQUARE Defensive Bastion Zone
        _drawSquareZone(
          canvas,
          size,
          centerNormX: tower.normX,
          centerNormY: tower.normY,
          halfSpanNorm: 0.16,
          fillColor: const Color(0x18FB923C),
          borderColor: const Color(0xCCFB923C),
        );
      }
    }

    // 2. Draw Cached Urban Road Corridors (Strictly used by Units and Zombies)
    final roadPaint = Paint()
      ..color = const Color(0x881E293B)
      ..strokeWidth = 22.0
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

    // 3. Draw Central HQ Command Bunker & Automated Point-Defense Cannon at (0.5, 0.5)
    final hqCenter = Offset(size.width * 0.5, size.height * 0.5);
    canvas.drawRect(
      Rect.fromCenter(
        center: hqCenter,
        width: 168.0 * 1.3,
        height: 168.0 * 1.3,
      ),
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
        ..color = const Color(0xFF10B981)
        ..strokeWidth = 3.0
        ..style = PaintingStyle.stroke,
    );
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

    // 4. Draw Off-Road Deployed Buildings (Towers, Fortresses, Refineries, Barracks, Factories, Forward HQs)
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

    // 5. Draw Soldiers & Heavy Vehicles Exiting Off-Road Buildings & Moving Strictly Along Real Roads
    for (final squad in squads) {
      final pos = Offset(squad.normX * size.width, squad.normY * size.height);
      if (squad.roadPath.isNotEmpty) {
        final unitRoadPath = Path()..moveTo(pos.dx, pos.dy);
        for (var i = squad.roadPathIndex; i < squad.roadPath.length; i++) {
          final wp = squad.roadPath[i];
          unitRoadPath.lineTo(wp.x * size.width, wp.y * size.height);
        }
        canvas.drawPath(
          unitRoadPath,
          Paint()
            ..color = const Color(0xAA10B981)
            ..strokeWidth = 2.0
            ..style = PaintingStyle.stroke,
        );
      }
      canvas.drawCircle(
        pos,
        squad.unitType == TrainableUnitType.heavyVehicle ? 12.0 : 9.0,
        Paint()
          ..color = squad.unitType == TrainableUnitType.heavyVehicle
              ? const Color(0xFF06B6D4)
              : const Color(0xFF10B981),
      );
    }

    // 6. Draw Zombie Hostiles Marching Strictly Along Real Roads
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
