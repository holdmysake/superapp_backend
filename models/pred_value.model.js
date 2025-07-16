import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Trunkline from './trunkline.model.js'
import Spot from './spot.model.js'

const PredValue = sequelize.define('pred_value', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    tline_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: Trunkline,
            key: 'tline_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    spot_id: {
        type: DataTypes.STRING(10),
        allowNull: false,
        references: {
            model: Spot,
            key: 'spot_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    is_linear: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    tline_length: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    drop_value: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    normal_value: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    on_value: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    off_value: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'pred_value',
    timestamps: false,
    underscored: true
})

export default PredValue
