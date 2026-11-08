import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'injection_container.dart' as di;
import 'presentation/bloc/tactical_defense_cubit.dart';
import 'presentation/pages/tactical_defense_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await di.initDependencies();
  runApp(const SectorZeroCleanArchApp());
}

class SectorZeroCleanArchApp extends StatelessWidget {
  const SectorZeroCleanArchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sector Zero: City Map Defense',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF090D16),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFF59E0B),
          brightness: Brightness.dark,
        ),
      ),
      home: BlocProvider<TacticalDefenseCubit>(
        create: (_) => di.sl<TacticalDefenseCubit>()..initializeGameSession(),
        child: const TacticalDefensePage(),
      ),
    );
  }
}
